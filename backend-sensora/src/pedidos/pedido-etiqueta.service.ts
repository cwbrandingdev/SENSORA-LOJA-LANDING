import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { MelhorEnvioService } from '../melhor-envio/melhor-envio.service';
import { PrismaService } from '../prisma/prisma.service';
import { Pedido } from './entities/pedido.entity';
import { StatusEnvio } from './enums/status-envio.enum';
import { StatusPedido } from './enums/status-pedido.enum';
import { PedidosService } from './pedidos.service';

// Etiqueta de ida (loja -> cliente) no Melhor Envio, gerada pelo admin.
// Mesmo ciclo da logística reversa (DevolucoesService.gerarLogistica):
// criar no carrinho -> comprar com o saldo da carteira -> gerar -> imprimir.
// Cada passo concluído fica gravado no pedido e, antes de comprar ou gerar,
// o Melhor Envio é consultado — uma tentativa anterior pode ter caído no
// meio. Não marca o pedido como enviado: isso continua sendo o "Marcar como
// enviado" depois de postar (o rastreio já vem preenchido).
@Injectable()
export class PedidoEtiquetaService {
  private readonly logger = new Logger(PedidoEtiquetaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pedidosService: PedidosService,
    private readonly melhorEnvioService: MelhorEnvioService,
  ) {}

  async gerar(
    id: number,
    user: UsuarioAutenticado,
    chaveNotaFiscal?: string,
  ): Promise<Pedido> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: { usuario: true, itens: { include: { produto: true } } },
    });
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado');
    }
    if (pedido.etiquetaGeradaEm) {
      return this.pedidosService.findOne(id, user);
    }
    if (
      (pedido.status as StatusPedido) !== StatusPedido.PAGO ||
      (pedido.statusEnvio as StatusEnvio) !== StatusEnvio.NAO_ENVIADO
    ) {
      throw new ConflictException(
        'Só é possível gerar etiqueta de pedido pago e ainda não enviado.',
      );
    }

    let idExterno = pedido.etiquetaIdExterno;
    if (!idExterno) {
      const { usuario } = pedido;
      if (!pedido.freteServicoId) {
        throw new ConflictException(
          'O pedido não tem o serviço de frete registrado.',
        );
      }
      if (!usuario?.cpf || !usuario.telefone) {
        throw new ConflictException(
          'O cliente não tem CPF ou telefone cadastrado. Peça para ele completar em Minha Conta > Dados pessoais.',
        );
      }
      if (
        !pedido.enderecoCep ||
        !pedido.enderecoRua ||
        !pedido.enderecoNumero ||
        !pedido.enderecoBairro ||
        !pedido.enderecoCidade ||
        !pedido.enderecoEstado
      ) {
        throw new ConflictException(
          'O pedido não tem o endereço de entrega completo registrado.',
        );
      }
      // 409 (não 500) para a lista do que falta chegar à tela do admin.
      const faltandoLoja = this.melhorEnvioService.dadosLojaFaltando;
      if (faltandoLoja.length > 0) {
        throw new ConflictException(
          `Dados da loja incompletos para gerar a etiqueta: defina ${faltandoLoja.join(', ')}.`,
        );
      }
      // Jadlog (e o Melhor Envio no PR) recusa declaração de conteúdo.
      // Sem a NF-e a API devolve 422; recusamos antes, com a instrução.
      if (
        !chaveNotaFiscal &&
        (pedido.freteTransportadora ?? '')
          .toLowerCase()
          .includes('jadlog')
      ) {
        throw new ConflictException(
          'A Jadlog não aceita declaração de conteúdo saindo do Paraná. Informe a chave da NF-e (44 dígitos) para gerar a etiqueta.',
        );
      }

      const itens = pedido.itens.map((item) => ({
        nome: item.produto.nome,
        quantidade: item.quantidade,
        valorUnitario: Number(item.precoUnitario),
      }));
      const quantidade = itens.reduce(
        (soma, item) => soma + item.quantidade,
        0,
      );
      const valorDeclarado = itens.reduce(
        (soma, item) => soma + item.quantidade * item.valorUnitario,
        0,
      );

      const criado = await this.melhorEnvioService.criarEnvio({
        servicoId: pedido.freteServicoId,
        destinatario: {
          nome: pedido.clienteNome ?? usuario.nome,
          cpf: usuario.cpf,
          telefone: usuario.telefone,
          email: pedido.clienteEmail ?? usuario.email,
          rua: pedido.enderecoRua,
          numero: pedido.enderecoNumero,
          complemento: pedido.enderecoComplemento,
          bairro: pedido.enderecoBairro,
          cidade: pedido.enderecoCidade,
          uf: pedido.enderecoEstado,
          cep: pedido.enderecoCep,
        },
        itens,
        pacote: this.melhorEnvioService.pacoteParaQuantidade(quantidade),
        valorDeclarado: Math.round(valorDeclarado * 100) / 100,
        chaveNotaFiscal,
      });

      // Gravado logo em seguida: uma nova tentativa continua deste envio.
      const gravado = await this.prisma.pedido.updateMany({
        where: { id, etiquetaIdExterno: null },
        data: { etiquetaIdExterno: criado.id },
      });
      if (gravado.count === 0) {
        // Outro clique gravou o envio dele primeiro. Este fica no carrinho
        // do Melhor Envio sem ser pago (sem cobrança).
        this.logger.warn(
          `Envio ${criado.id} ficou sem uso no carrinho do Melhor Envio (pedido ${id}).`,
        );
      }
      idExterno = (await this.prisma.pedido.findUnique({ where: { id } }))!
        .etiquetaIdExterno!;
    }

    let situacao = await this.melhorEnvioService.consultarEnvio(idExterno);
    if (!situacao.pago) {
      await this.melhorEnvioService.comprarEnvio(idExterno);
      situacao = await this.melhorEnvioService.consultarEnvio(idExterno);
      if (!situacao.pago) {
        throw new ConflictException(
          'O Melhor Envio ainda não confirmou o pagamento da etiqueta. Tente novamente em instantes: a nova tentativa confere o pagamento antes de comprar de novo.',
        );
      }
    }
    if (!situacao.gerado) {
      await this.melhorEnvioService.gerarEnvio(idExterno);
      situacao = await this.melhorEnvioService.consultarEnvio(idExterno);
    }

    await this.prisma.pedido.updateMany({
      where: { id, etiquetaGeradaEm: null },
      data: {
        etiquetaGeradaEm: situacao.geradoEm ?? new Date(),
        ...(situacao.codigoRastreio
          ? { codigoRastreio: situacao.codigoRastreio }
          : {}),
      },
    });

    return this.pedidosService.findOne(id, user);
  }

  // URL do PDF da etiqueta, gerada agora pelo Melhor Envio (nunca guardada).
  // Aproveita para buscar o rastreio, se ainda não veio na geração.
  async urlEtiqueta(
    id: number,
    user: UsuarioAutenticado,
  ): Promise<{ url: string }> {
    const pedido = await this.pedidosService.findOne(id, user);
    const atual = await this.prisma.pedido.findUnique({ where: { id } });
    if (!atual?.etiquetaGeradaEm || !atual.etiquetaIdExterno) {
      throw new ConflictException('Este pedido ainda não tem etiqueta gerada.');
    }

    if (!pedido.codigoRastreio) {
      const situacao = await this.melhorEnvioService.consultarEnvio(
        atual.etiquetaIdExterno,
      );
      if (situacao.codigoRastreio) {
        await this.prisma.pedido.update({
          where: { id },
          data: { codigoRastreio: situacao.codigoRastreio },
        });
      }
    }

    return {
      url: await this.melhorEnvioService.urlImpressao(atual.etiquetaIdExterno),
    };
  }
}

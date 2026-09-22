import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  StatusFiscal as StatusFiscalPrisma,
  type NotaFiscal as NotaFiscalPrisma,
} from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotaFiscal } from './entities/nota-fiscal.entity';
import { StatusFiscal } from './enums/status-fiscal.enum';
import {
  FISCAL_PROVIDER,
  type FiscalProvider,
} from './providers/fiscal-provider.interface';

// Infraestrutura Fiscal (preparação arquitetural) — ver relatório da
// vistoria "infra neutra para futura emissão de notas fiscais". Este
// service NÃO é chamado por nenhum fluxo de pagamento nesta etapa
// (CheckoutService.confirmarPagamento não referencia FiscalService em
// nenhum ponto) — existe pronto para uma etapa futura decidir COMO e QUANDO
// acionar a emissão real, sempre depois do commit da transação de
// pagamento, nunca dentro dela (ver riscos documentados na vistoria: uma
// chamada HTTP externa dentro da `$transaction` que já faz status+estoque
// seguraria a transação pelo tempo da chamada).
@Injectable()
export class FiscalService {
  constructor(
    private readonly prisma: PrismaService,
    // Opcional de propósito, mesmo padrão preguiçoso já usado por
    // AsaasService/ImagekitService: nenhuma classe é registrada sob
    // FISCAL_PROVIDER em FiscalModule nesta etapa (nenhum provedor foi
    // escolhido), então `provider` é sempre `undefined` hoje — @Optional()
    // evita que o Nest recuse subir o módulo por falta de um binding para
    // este token.
    @Optional()
    @Inject(FISCAL_PROVIDER)
    private readonly provider?: FiscalProvider,
  ) {}

  // Espelha AsaasService.isConfigured() — nunca expõe detalhes do provedor,
  // só se há um configurado. Sem uso em nenhum controller ainda (nenhuma
  // "Central de Integrações" para o Fiscal foi pedida nesta etapa); fica
  // disponível para quando isso existir.
  isConfigured(): boolean {
    return Boolean(this.provider);
  }

  async buscarPorPedido(pedidoId: number): Promise<NotaFiscal | null> {
    const notaFiscal = await this.prisma.notaFiscal.findUnique({
      where: { pedidoId },
    });
    return notaFiscal ? this.paraNotaFiscal(notaFiscal) : null;
  }

  // Captura (ou atualiza) o snapshot fiscal do pedido a partir dos dados já
  // persistidos — nunca de Endereco diretamente: `Pedido` já guarda seu
  // próprio snapshot de endereço/nome/e-mail (ver CheckoutService.
  // createSession), então basta copiar dali; só `destinatarioDocumento`
  // (CPF) precisa ser lido de Usuario, porque o Pedido nunca guardou esse
  // campo (achado da vistoria de dados do cliente). Nenhuma chamada
  // externa, nenhum dado inventado: campos ausentes no Pedido/Usuario (ex.:
  // CPF nunca preenchido) simplesmente ficam `null` aqui também.
  //
  // Bloqueado depois que a nota sai de NAO_EMITIDA: uma vez que uma
  // emissão real tiver acontecido (etapa futura), o snapshot não pode mais
  // ser reescrito por este método — mesmo princípio de "documento já
  // emitido não muda retroativamente" documentado no schema.
  async prepararSnapshot(pedidoId: number): Promise<NotaFiscal> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
    });
    if (!pedido) {
      throw new NotFoundException(`Pedido com id ${pedidoId} não encontrado`);
    }

    const existente = await this.prisma.notaFiscal.findUnique({
      where: { pedidoId },
    });
    if (existente && existente.status !== StatusFiscalPrisma.NAO_EMITIDA) {
      throw new ConflictException(
        `NotaFiscal do pedido ${pedidoId} já está em ${existente.status} — snapshot não pode mais ser alterado.`,
      );
    }

    const usuario = pedido.usuarioId
      ? await this.prisma.usuario.findUnique({
          where: { id: pedido.usuarioId },
          select: { cpf: true },
        })
      : null;

    const snapshot = {
      destinatarioNome: pedido.clienteNome,
      destinatarioDocumento: usuario?.cpf ?? null,
      destinatarioEmail: pedido.clienteEmail,
      enderecoCep: pedido.enderecoCep,
      enderecoRua: pedido.enderecoRua,
      enderecoNumero: pedido.enderecoNumero,
      enderecoComplemento: pedido.enderecoComplemento,
      enderecoBairro: pedido.enderecoBairro,
      enderecoCidade: pedido.enderecoCidade,
      enderecoEstado: pedido.enderecoEstado,
    };

    const notaFiscal = await this.prisma.notaFiscal.upsert({
      where: { pedidoId },
      create: { pedidoId, ...snapshot },
      update: snapshot,
    });

    return this.paraNotaFiscal(notaFiscal);
  }

  // Ponto único e explícito de onde uma emissão real seria acionada — ver
  // ponto 9 da tarefa: nenhum código chama este método ainda. Sempre
  // recusa: sem FiscalProvider configurado (sempre o caso hoje, ver
  // construtor) OU, mesmo com um configurado no futuro, a orquestração real
  // (montar FiscalEmissaoInput a partir do snapshot, chamar
  // provider.emitir(), interpretar o resultado, persistir) ainda não foi
  // escrita — implementá-la é trabalho de uma etapa futura, fora do escopo
  // desta preparação.
  emitir(pedidoId: number): Promise<never> {
    throw new ServiceUnavailableException(
      this.provider
        ? `Emissão fiscal do pedido ${pedidoId} ainda não implementada.`
        : `Nenhum provedor fiscal configurado — não é possível emitir nota fiscal para o pedido ${pedidoId} ainda.`,
    );
  }

  private paraNotaFiscal(notaFiscal: NotaFiscalPrisma): NotaFiscal {
    return {
      id: notaFiscal.id,
      pedidoId: notaFiscal.pedidoId,
      status: notaFiscal.status as StatusFiscal,
      numero: notaFiscal.numero,
      serie: notaFiscal.serie,
      chaveAcesso: notaFiscal.chaveAcesso,
      protocolo: notaFiscal.protocolo,
      xmlUrl: notaFiscal.xmlUrl,
      pdfUrl: notaFiscal.pdfUrl,
      mensagemErro: notaFiscal.mensagemErro,
      tentativas: notaFiscal.tentativas,
      destinatarioNome: notaFiscal.destinatarioNome,
      destinatarioDocumento: notaFiscal.destinatarioDocumento,
      destinatarioEmail: notaFiscal.destinatarioEmail,
      enderecoCep: notaFiscal.enderecoCep,
      enderecoRua: notaFiscal.enderecoRua,
      enderecoNumero: notaFiscal.enderecoNumero,
      enderecoComplemento: notaFiscal.enderecoComplemento,
      enderecoBairro: notaFiscal.enderecoBairro,
      enderecoCidade: notaFiscal.enderecoCidade,
      enderecoEstado: notaFiscal.enderecoEstado,
      criadoEm: notaFiscal.criadoEm,
      atualizadoEm: notaFiscal.atualizadoEm,
      emitidoEm: notaFiscal.emitidoEm,
    };
  }
}

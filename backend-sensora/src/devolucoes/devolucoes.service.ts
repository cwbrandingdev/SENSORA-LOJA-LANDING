import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type {
  Devolucao as DevolucaoPrisma,
  EvidenciaDevolucao as EvidenciaDevolucaoPrisma,
  ItemDevolucao as ItemDevolucaoPrisma,
  Prisma,
} from '../../generated/prisma/client';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { escaparHtml } from '../common/utils/html.util';
import { ImagekitService } from '../imagekit/imagekit.service';
import { MailService } from '../mail/mail.service';
import { StatusEnvio } from '../pedidos/enums/status-envio.enum';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDevolucaoDto } from './dto/create-devolucao.dto';
import {
  Devolucao,
  DevolucaoAnalise,
  DevolucaoResumoAdmin,
  DevolucoesDoPedido,
  EvidenciaDevolucao,
} from './entities/devolucao.entity';
import { StatusDevolucao } from './enums/status-devolucao.enum';

// Status em que o Admin ainda pode aprovar ou recusar.
const STATUS_AGUARDANDO_ANALISE = [
  StatusDevolucao.SOLICITADA,
  StatusDevolucao.EM_ANALISE,
];

// Devoluções recusadas ou canceladas não "gastam" a quantidade do item —
// ela volta a ficar disponível para uma nova solicitação.
const STATUS_QUE_NAO_CONTAM = [
  StatusDevolucao.RECUSADA,
  StatusDevolucao.CANCELADA,
];

// Evidências (fotos) da devolução.
export const MAXIMO_EVIDENCIAS = 5;
export const TAMANHO_MAXIMO_EVIDENCIA = 5 * 1024 * 1024; // 5 MB
const VALIDADE_URL_EVIDENCIA_SEGUNDOS = 10 * 60;

// Arquivo recebido pelo FileInterceptor (multer, em memória). Só os campos
// usados aqui — nome e tipo informados pelo navegador são ignorados.
export type ArquivoEnviado = { buffer: Buffer; size: number };

// Identifica o formato pelos primeiros bytes do arquivo (nunca pela
// extensão ou pelo Content-Type, que o cliente controla).
// JPEG: FF D8 FF. PNG: 89 50 4E 47 0D 0A 1A 0A. WEBP: "RIFF" .... "WEBP".
export function extensaoDaImagem(
  conteudo: Buffer,
): 'jpg' | 'png' | 'webp' | null {
  const comeca = (bytes: number[], inicio = 0) =>
    bytes.every((byte, i) => conteudo[inicio + i] === byte);

  if (comeca([0xff, 0xd8, 0xff])) {
    return 'jpg';
  }
  if (comeca([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'png';
  }
  if (comeca([0x52, 0x49, 0x46, 0x46]) && comeca([0x57, 0x45, 0x42, 0x50], 8)) {
    return 'webp';
  }
  return null;
}

@Injectable()
export class DevolucoesService {
  private readonly logger = new Logger(DevolucoesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly imagekitService: ImagekitService,
    private readonly mailService: MailService,
  ) {}

  // Cliente solicita a devolução de itens de um pedido já enviado. Tudo que
  // vale (dono, status, itens, quantidades, preço) é lido do banco — do
  // corpo da requisição só vêm motivo, descrição e itens/quantidades.
  async criar(
    pedidoId: number,
    dto: CreateDevolucaoDto,
    user: UsuarioAutenticado,
  ): Promise<Devolucao> {
    const motivo = dto.motivo.trim();
    if (!motivo) {
      throw new BadRequestException('Informe o motivo da devolução.');
    }
    const descricao = dto.descricao?.trim() || null;

    const itemPedidoIds = dto.itens.map((item) => item.itemPedidoId);
    if (new Set(itemPedidoIds).size !== itemPedidoIds.length) {
      throw new BadRequestException(
        'O mesmo item foi informado mais de uma vez.',
      );
    }

    const devolucao = await this.prisma.$transaction(async (tx) => {
      // Trava a linha do pedido até o fim da transação: duas solicitações
      // simultâneas para o mesmo pedido passam por aqui uma de cada vez, e a
      // segunda só lê o que já foi devolvido depois que a primeira gravou.
      await tx.$queryRaw`SELECT id FROM "Pedido" WHERE id = ${pedidoId} FOR UPDATE`;

      const pedido = await tx.pedido.findUnique({
        where: { id: pedidoId },
        include: { itens: true },
      });

      // Mesma mensagem para "não existe" e "é de outro usuário" — mesmo
      // padrão de PedidosService.findOne.
      if (!pedido || pedido.usuarioId !== user.id) {
        throw new NotFoundException(`Pedido com id ${pedidoId} não encontrado`);
      }

      if ((pedido.status as StatusPedido) !== StatusPedido.PAGO) {
        throw new ConflictException(
          `Pedido com status ${pedido.status} não pode ser devolvido.`,
        );
      }

      // Pedido pago e ainda não enviado continua usando o cancelamento com
      // reembolso (PedidosService.solicitarReembolso), não a devolução.
      if ((pedido.statusEnvio as StatusEnvio) !== StatusEnvio.ENVIADO) {
        throw new ConflictException(
          'Pedido ainda não enviado não pode ser devolvido. Solicite o reembolso.',
        );
      }

      const itensDoPedido = new Map(
        pedido.itens.map((item) => [item.id, item]),
      );

      // Lido dentro da transação, depois da trava do pedido.
      const jaDevolvido = await this.quantidadesJaDevolvidas(tx, itemPedidoIds);

      for (const item of dto.itens) {
        const itemPedido = itensDoPedido.get(item.itemPedidoId);
        if (!itemPedido) {
          throw new BadRequestException(
            `Item ${item.itemPedidoId} não pertence a este pedido.`,
          );
        }

        const disponivel =
          itemPedido.quantidade - (jaDevolvido.get(item.itemPedidoId) ?? 0);

        if (item.quantidade > disponivel) {
          throw new BadRequestException(
            `Quantidade indisponível para devolução do item ${item.itemPedidoId}: máximo ${disponivel}.`,
          );
        }
      }

      return tx.devolucao.create({
        data: {
          pedidoId,
          usuarioId: user.id,
          motivo,
          descricao,
          status: StatusDevolucao.SOLICITADA,
          itens: {
            create: dto.itens.map((item) => ({
              itemPedidoId: item.itemPedidoId,
              quantidade: item.quantidade,
              // Preço pago no pedido, nunca o preço atual do produto nem
              // um valor vindo do cliente.
              precoUnitario: itensDoPedido.get(item.itemPedidoId)!
                .precoUnitario,
            })),
          },
        },
        include: { itens: true },
      });
    });

    return this.paraDevolucao(devolucao);
  }

  // Histórico do pedido para a tela do cliente: todas as devoluções dele (as
  // mais recentes primeiro, com itens e fotos em URLs assinadas) e o saldo
  // que ainda pode ser devolvido de cada item — calculado aqui, nunca no
  // frontend. É só uma prévia: `criar` continua validando com a trava.
  async listarDoPedido(
    pedidoId: number,
    user: UsuarioAutenticado,
  ): Promise<DevolucoesDoPedido> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      include: { itens: true },
    });

    // Mesma mensagem para "não existe" e "é de outro usuário" — mesmo
    // padrão de PedidosService.findOne.
    if (!pedido || pedido.usuarioId !== user.id) {
      throw new NotFoundException(`Pedido com id ${pedidoId} não encontrado`);
    }

    const devolucoes = await this.prisma.devolucao.findMany({
      // usuarioId: defesa extra, além do dono do pedido conferido acima.
      where: { pedidoId, usuarioId: user.id },
      orderBy: [{ solicitadaEm: 'desc' }, { id: 'desc' }],
      include: { itens: true, evidencias: { orderBy: { id: 'asc' } } },
    });

    const jaDevolvido = await this.quantidadesJaDevolvidas(
      this.prisma,
      pedido.itens.map((item) => item.id),
    );

    return {
      devolucoes: devolucoes.map((devolucao) => this.paraDevolucao(devolucao)),
      itensDisponiveis: pedido.itens.map((item) => ({
        itemPedidoId: item.id,
        quantidadeDisponivel: Math.max(
          0,
          item.quantidade - (jaDevolvido.get(item.id) ?? 0),
        ),
      })),
    };
  }

  // Devolução do próprio cliente, com os itens e as fotos (URLs assinadas
  // geradas agora, com validade curta).
  async buscar(
    pedidoId: number,
    devolucaoId: number,
    user: UsuarioAutenticado,
  ): Promise<Devolucao> {
    const devolucao = await this.prisma.devolucao.findUnique({
      where: { id: devolucaoId },
      include: { itens: true, evidencias: { orderBy: { id: 'asc' } } },
    });
    return this.paraDevolucao(
      this.devolucaoDoCliente(devolucao, pedidoId, user),
    );
  }

  // Uma foto por chamada. Fluxo: valida o arquivo -> confere dono/status/
  // limite -> envia ao ImageKit (privado, pasta e nome definidos aqui) ->
  // grava no banco com a devolução travada e o limite conferido de novo.
  async adicionarEvidencia(
    pedidoId: number,
    devolucaoId: number,
    arquivo: ArquivoEnviado | undefined,
    user: UsuarioAutenticado,
  ): Promise<EvidenciaDevolucao> {
    if (!arquivo) {
      throw new BadRequestException('Envie uma foto.');
    }
    // O FileInterceptor já barra acima de 5 MB; conferido de novo aqui.
    if (arquivo.size > TAMANHO_MAXIMO_EVIDENCIA) {
      throw new BadRequestException('A foto deve ter no máximo 5 MB.');
    }
    const extensao = extensaoDaImagem(arquivo.buffer);
    if (!extensao) {
      throw new BadRequestException(
        'Formato não permitido. Envie uma foto JPEG, PNG ou WEBP.',
      );
    }

    // Confere antes de enviar, para não subir arquivo ao ImageKit à toa.
    const antes = await this.prisma.devolucao.findUnique({
      where: { id: devolucaoId },
      include: { _count: { select: { evidencias: true } } },
    });
    this.garantirQuePodeReceberFoto(antes, pedidoId, user);

    const enviado = await this.imagekitService.enviarArquivoPrivado(
      arquivo.buffer,
      `evidencia.${extensao}`,
      `/sensora/devolucoes/${devolucaoId}`,
    );

    try {
      const evidencia = await this.prisma.$transaction(async (tx) => {
        // Trava a devolução até o fim da transação: uploads simultâneos
        // gravam um de cada vez, e a contagem abaixo sempre vê os anteriores
        // — é isso que impede passar de 5 fotos.
        await tx.$queryRaw`SELECT id FROM "Devolucao" WHERE id = ${devolucaoId} FOR UPDATE`;

        const devolucao = await tx.devolucao.findUnique({
          where: { id: devolucaoId },
          include: { _count: { select: { evidencias: true } } },
        });
        this.garantirQuePodeReceberFoto(devolucao, pedidoId, user);

        return tx.evidenciaDevolucao.create({
          data: {
            devolucaoId,
            fileId: enviado.fileId,
            caminho: enviado.caminho,
          },
        });
      });

      return this.paraEvidencia(evidencia);
    } catch (erro) {
      // O arquivo já está no ImageKit, mas não foi registrado: apaga para não
      // deixar arquivo solto. Se nem isso der certo, só registra no log.
      await this.imagekitService.apagarArquivo(enviado.fileId).catch(() => {
        this.logger.error(
          `Arquivo ${enviado.fileId} ficou no ImageKit sem registro (devolução ${devolucaoId}).`,
        );
      });
      throw erro;
    }
  }

  // Apaga primeiro no ImageKit: se isso falhar, o registro continua no banco
  // (a foto continua aparecendo) e o erro é devolvido ao cliente, que pode
  // tentar de novo — nunca some do banco com o arquivo ainda no ImageKit.
  async removerEvidencia(
    pedidoId: number,
    devolucaoId: number,
    evidenciaId: number,
    user: UsuarioAutenticado,
  ): Promise<void> {
    const devolucao = await this.prisma.devolucao.findUnique({
      where: { id: devolucaoId },
      include: { evidencias: { where: { id: evidenciaId } } },
    });
    const daCliente = this.devolucaoDoCliente(devolucao, pedidoId, user);

    const evidencia = daCliente.evidencias[0];
    if (!evidencia) {
      throw new NotFoundException('Foto não encontrada');
    }
    this.garantirSolicitada(daCliente);

    await this.imagekitService.apagarArquivo(evidencia.fileId);
    await this.prisma.evidenciaDevolucao.deleteMany({
      where: { id: evidencia.id },
    });
  }

  // ---------------------------------------------------------------------
  // Etapa 7 — análise pelo ADMIN (rotas em DevolucoesAdminController).
  // Aprovar/recusar só decidem: nenhum reembolso, nenhum estoque.
  // ---------------------------------------------------------------------

  // Fila do Admin, mais recentes primeiro. Sem fotos: nenhuma URL assinada
  // é gerada aqui (só no detalhe).
  async listarParaAdmin(
    status?: StatusDevolucao,
  ): Promise<DevolucaoResumoAdmin[]> {
    const devolucoes = await this.prisma.devolucao.findMany({
      where: status ? { status } : {},
      orderBy: [{ solicitadaEm: 'desc' }, { id: 'desc' }],
      include: {
        pedido: {
          select: { numero: true, clienteNome: true, clienteEmail: true },
        },
        usuario: { select: { nome: true, email: true } },
        itens: { select: { quantidade: true } },
        _count: { select: { evidencias: true } },
      },
    });

    return devolucoes.map((devolucao) => ({
      id: devolucao.id,
      pedidoId: devolucao.pedidoId,
      pedidoNumero: devolucao.pedido.numero,
      clienteNome: devolucao.usuario?.nome ?? devolucao.pedido.clienteNome,
      clienteEmail: devolucao.usuario?.email ?? devolucao.pedido.clienteEmail,
      status: devolucao.status as StatusDevolucao,
      solicitadaEm: devolucao.solicitadaEm,
      analisadaEm: devolucao.analisadaEm,
      quantidadeItens: devolucao.itens.reduce(
        (soma, item) => soma + item.quantidade,
        0,
      ),
      quantidadeFotos: devolucao._count.evidencias,
    }));
  }

  // Tudo que o Admin precisa para decidir, com as fotos em URL assinada de
  // 10 minutos (nunca fileId/caminho).
  async buscarParaAnalise(devolucaoId: number): Promise<DevolucaoAnalise> {
    const devolucao = await this.prisma.devolucao.findUnique({
      where: { id: devolucaoId },
      include: {
        pedido: true,
        usuario: { select: { nome: true, email: true } },
        analisadoPor: { select: { nome: true } },
        itens: {
          include: {
            itemPedido: {
              select: {
                quantidade: true,
                produto: { select: { nome: true } },
              },
            },
          },
        },
        evidencias: { orderBy: { id: 'asc' } },
      },
    });
    if (!devolucao) {
      throw new NotFoundException('Devolução não encontrada');
    }

    const { pedido } = devolucao;
    return {
      id: devolucao.id,
      status: devolucao.status as StatusDevolucao,
      motivo: devolucao.motivo,
      descricao: devolucao.descricao,
      solicitadaEm: devolucao.solicitadaEm,
      analisadaEm: devolucao.analisadaEm,
      observacaoAnalise: devolucao.observacaoAnalise,
      analisadoPorNome: devolucao.analisadoPor?.nome ?? null,
      pedido: {
        id: pedido.id,
        numero: pedido.numero,
        data: pedido.data,
        status: pedido.status,
        statusEnvio: pedido.statusEnvio,
        enviadoEm: pedido.enviadoEm,
        total: Number(pedido.total),
      },
      cliente: {
        nome: devolucao.usuario?.nome ?? pedido.clienteNome,
        email: devolucao.usuario?.email ?? pedido.clienteEmail,
      },
      itens: devolucao.itens.map((item) => ({
        id: item.id,
        itemPedidoId: item.itemPedidoId,
        produtoNome: item.itemPedido.produto.nome,
        quantidade: item.quantidade,
        quantidadeComprada: item.itemPedido.quantidade,
        precoUnitario: Number(item.precoUnitario),
      })),
      evidencias: devolucao.evidencias.map((evidencia) =>
        this.paraEvidencia(evidencia),
      ),
    };
  }

  async aprovar(
    devolucaoId: number,
    adminId: number,
    observacao?: string,
  ): Promise<DevolucaoAnalise> {
    return this.decidir(
      devolucaoId,
      StatusDevolucao.APROVADA,
      adminId,
      observacao?.trim() || null,
    );
  }

  // Na recusa a observação é obrigatória (vai no e-mail ao cliente).
  async recusar(
    devolucaoId: number,
    adminId: number,
    observacao: string,
  ): Promise<DevolucaoAnalise> {
    const observacaoLimpa = observacao?.trim();
    if (!observacaoLimpa) {
      throw new BadRequestException('Informe o motivo da recusa.');
    }
    return this.decidir(
      devolucaoId,
      StatusDevolucao.RECUSADA,
      adminId,
      observacaoLimpa,
    );
  }

  // Uma única atualização atômica, condicionada ao estado atual (mesmo
  // padrão de PedidosService.cancelar/solicitarReembolso): só muda se a
  // devolução ainda aguarda análise E o pedido continua PAGO + ENVIADO.
  // Duas decisões simultâneas: o Postgres serializa, só uma vê count = 1.
  // Também espera a trava do upload de fotos (SELECT ... FOR UPDATE na
  // devolução), então nenhuma foto entra depois da decisão.
  private async decidir(
    devolucaoId: number,
    novoStatus: StatusDevolucao.APROVADA | StatusDevolucao.RECUSADA,
    adminId: number,
    observacao: string | null,
  ): Promise<DevolucaoAnalise> {
    const resultado = await this.prisma.devolucao.updateMany({
      where: {
        id: devolucaoId,
        status: { in: STATUS_AGUARDANDO_ANALISE },
        pedido: { status: StatusPedido.PAGO, statusEnvio: StatusEnvio.ENVIADO },
      },
      data: {
        status: novoStatus,
        analisadaEm: new Date(),
        analisadoPorId: adminId,
        observacaoAnalise: observacao,
      },
    });

    if (resultado.count === 0) {
      await this.explicarDecisaoRecusada(devolucaoId);
    }

    // Só depois de a decisão estar gravada; falha no e-mail não a desfaz.
    await this.avisarClienteDaDecisao(devolucaoId);

    return this.buscarParaAnalise(devolucaoId);
  }

  // A decisão não foi aplicada: relê o estado atual para responder o motivo
  // certo (404, status que já não permite análise ou pedido que mudou).
  private async explicarDecisaoRecusada(devolucaoId: number): Promise<never> {
    const atual = await this.prisma.devolucao.findUnique({
      where: { id: devolucaoId },
      include: { pedido: { select: { status: true, statusEnvio: true } } },
    });
    if (!atual) {
      throw new NotFoundException('Devolução não encontrada');
    }
    if (!STATUS_AGUARDANDO_ANALISE.includes(atual.status as StatusDevolucao)) {
      throw new ConflictException(
        `Devolução com status ${atual.status} não pode mais ser analisada.`,
      );
    }
    throw new ConflictException(
      `O pedido desta devolução não está mais pago e enviado (status ${atual.pedido.status}, envio ${atual.pedido.statusEnvio}); a devolução não pode ser analisada.`,
    );
  }

  // E-mail ao cliente sobre a decisão. Destinatário: e-mail do usuário da
  // devolução ou, se ele não existir mais, o e-mail gravado no pedido.
  // Todo texto variável é escapado antes de entrar no HTML. Nunca lança.
  private async avisarClienteDaDecisao(devolucaoId: number): Promise<void> {
    try {
      const devolucao = await this.prisma.devolucao.findUnique({
        where: { id: devolucaoId },
        include: {
          usuario: { select: { nome: true, email: true } },
          pedido: {
            select: { numero: true, clienteNome: true, clienteEmail: true },
          },
        },
      });
      if (!devolucao) {
        return;
      }

      const destinatario =
        devolucao.usuario?.email ?? devolucao.pedido.clienteEmail;
      if (!destinatario) {
        this.logger.warn(
          `Devolução ${devolucaoId} sem e-mail de cliente — aviso da decisão não enviado.`,
        );
        return;
      }

      const nome = escaparHtml(
        devolucao.usuario?.nome ?? devolucao.pedido.clienteNome ?? 'cliente',
      );
      const numero = escaparHtml(devolucao.pedido.numero);
      const detalhes =
        `<p>Motivo informado: ${escaparHtml(devolucao.motivo)}</p>` +
        (devolucao.descricao
          ? `<p>Descrição: ${escaparHtml(devolucao.descricao)}</p>`
          : '');

      const aprovada =
        (devolucao.status as StatusDevolucao) === StatusDevolucao.APROVADA;
      const html = aprovada
        ? `<p>Olá, ${nome}.</p>` +
          `<p>Sua solicitação de devolução do pedido ${numero} foi aprovada.</p>` +
          detalhes +
          '<p>As instruções para enviar o produto de volta serão disponibilizadas em breve.</p>'
        : `<p>Olá, ${nome}.</p>` +
          `<p>Sua solicitação de devolução do pedido ${numero} não foi aprovada.</p>` +
          detalhes +
          `<p>Motivo da recusa: ${escaparHtml(devolucao.observacaoAnalise ?? '')}</p>` +
          '<p>Se tiver dúvidas, é só responder este e-mail.</p>';

      await this.mailService.enviarEmail({
        to: destinatario,
        subject: aprovada
          ? `Devolução aprovada — pedido ${devolucao.pedido.numero}`
          : `Devolução não aprovada — pedido ${devolucao.pedido.numero}`,
        html,
      });
    } catch (erro) {
      this.logger.error(
        `Falha ao avisar o cliente sobre a decisão da devolução ${devolucaoId}.`,
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }

  // Regra única do saldo (usada por `criar` e `listarDoPedido`): quanto de
  // cada ItemPedido já está em devoluções que consomem saldo — todas, menos
  // RECUSADA e CANCELADA. Recebe o client para rodar dentro da transação
  // quando preciso. Devolve itemPedidoId -> quantidade já devolvida.
  private async quantidadesJaDevolvidas(
    client: Prisma.TransactionClient,
    itemPedidoIds: number[],
  ): Promise<Map<number, number>> {
    const jaDevolvidos = await client.itemDevolucao.findMany({
      where: {
        itemPedidoId: { in: itemPedidoIds },
        devolucao: { status: { notIn: STATUS_QUE_NAO_CONTAM } },
      },
      select: { itemPedidoId: true, quantidade: true },
    });

    const soma = new Map<number, number>();
    for (const devolvido of jaDevolvidos) {
      soma.set(
        devolvido.itemPedidoId,
        (soma.get(devolvido.itemPedidoId) ?? 0) + devolvido.quantidade,
      );
    }
    return soma;
  }

  // Mesma mensagem para "não existe", "é de outro cliente" e "é de outro
  // pedido" — mesmo padrão de PedidosService.findOne.
  private devolucaoDoCliente<
    T extends { pedidoId: number; usuarioId: number | null },
  >(devolucao: T | null, pedidoId: number, user: UsuarioAutenticado): T {
    if (
      !devolucao ||
      devolucao.pedidoId !== pedidoId ||
      devolucao.usuarioId !== user.id
    ) {
      throw new NotFoundException('Devolução não encontrada');
    }
    return devolucao;
  }

  // Fotos só podem ser adicionadas/removidas antes da análise.
  private garantirSolicitada(devolucao: { status: string }): void {
    if ((devolucao.status as StatusDevolucao) !== StatusDevolucao.SOLICITADA) {
      throw new ConflictException(
        'As fotos só podem ser alteradas enquanto a devolução está aguardando análise.',
      );
    }
  }

  private garantirQuePodeReceberFoto(
    devolucao: (DevolucaoPrisma & { _count: { evidencias: number } }) | null,
    pedidoId: number,
    user: UsuarioAutenticado,
  ): void {
    const daCliente = this.devolucaoDoCliente(devolucao, pedidoId, user);
    this.garantirSolicitada(daCliente);
    if (daCliente._count.evidencias >= MAXIMO_EVIDENCIAS) {
      throw new BadRequestException(
        `Limite de ${MAXIMO_EVIDENCIAS} fotos por devolução atingido.`,
      );
    }
  }

  private paraEvidencia(
    evidencia: EvidenciaDevolucaoPrisma,
  ): EvidenciaDevolucao {
    return {
      id: evidencia.id,
      url: this.imagekitService.gerarUrlAssinada(
        evidencia.caminho,
        VALIDADE_URL_EVIDENCIA_SEGUNDOS,
      ),
      criadoEm: evidencia.criadoEm,
    };
  }

  private paraDevolucao(
    devolucao: DevolucaoPrisma & {
      itens: ItemDevolucaoPrisma[];
      evidencias?: EvidenciaDevolucaoPrisma[];
    },
  ): Devolucao {
    return {
      id: devolucao.id,
      pedidoId: devolucao.pedidoId,
      status: devolucao.status as StatusDevolucao,
      motivo: devolucao.motivo,
      descricao: devolucao.descricao,
      solicitadaEm: devolucao.solicitadaEm,
      analisadaEm: devolucao.analisadaEm ?? null,
      itens: devolucao.itens.map((item) => ({
        id: item.id,
        itemPedidoId: item.itemPedidoId,
        quantidade: item.quantidade,
        precoUnitario: Number(item.precoUnitario),
      })),
      evidencias: (devolucao.evidencias ?? []).map((evidencia) =>
        this.paraEvidencia(evidencia),
      ),
    };
  }
}

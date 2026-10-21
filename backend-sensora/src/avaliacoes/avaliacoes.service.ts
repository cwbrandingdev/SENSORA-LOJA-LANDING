import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { escaparHtml } from '../common/utils/html.util';
import { MailService } from '../mail/mail.service';
import { StatusEnvio } from '../pedidos/enums/status-envio.enum';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { PrismaService } from '../prisma/prisma.service';
import { SalvarAvaliacaoDto } from './dto/salvar-avaliacao.dto';
import {
  AvaliacaoAdmin,
  AvaliacaoDoCliente,
  AvaliacoesDoPedido,
  ResumoAvaliacoes,
} from './entities/avaliacao.entity';
import { StatusAvaliacao } from './enums/status-avaliacao.enum';

// Lembrete por e-mail para avaliar: um por pedido, DIAS_LEMBRETE depois de a
// avaliação ser liberada, só se ainda faltar avaliar algum produto.
export const DIAS_LEMBRETE_AVALIACAO = 3;
// Prazo mínimo de entrega (em dias) quando o pedido não guardou o do frete.
export const DIAS_MINIMOS_ENTREGA = 2;
const DIA_MS = 24 * 60 * 60 * 1000;
const INTERVALO_LEMBRETES_MS = 60 * 60 * 1000;
const LOTE_LEMBRETES = 50;
// Quantas avaliações aprovadas a página do produto mostra.
const LIMITE_AVALIACOES_PUBLICAS = 50;
const CAMINHO_CONTA_PEDIDOS = '/conta/pedidos';

// "Ana Souza Lima" -> "Ana L."; "Ana" -> "Ana". Gravado na criação: a loja
// nunca mostra o nome completo do cliente.
export function nomeParaExibicao(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'Cliente';
  if (partes.length === 1) return partes[0];
  return `${partes[0]} ${partes[partes.length - 1][0].toUpperCase()}.`;
}

// Quando a avaliação do pedido é liberada: na data prevista de entrega, ou
// seja, envio + prazo do frete. O prazo do frete é em dias úteis, então vira
// dias corridos (× 7/5) para não liberar antes de a encomenda chegar. Sem
// pagamento ou ainda não enviado: nunca (null).
export function dataLiberacaoAvaliacao(pedido: {
  status: StatusPedido | `${StatusPedido}`;
  statusEnvio: StatusEnvio | `${StatusEnvio}`;
  enviadoEm: Date | null;
  fretePrazoDias: number | null;
}): Date | null {
  if (
    pedido.status !== `${StatusPedido.PAGO}` ||
    pedido.statusEnvio !== `${StatusEnvio.ENVIADO}` ||
    !pedido.enviadoEm
  ) {
    return null;
  }
  const dias = Math.max(
    Math.ceil(((pedido.fretePrazoDias ?? 0) * 7) / 5),
    DIAS_MINIMOS_ENTREGA,
  );
  return new Date(pedido.enviadoEm.getTime() + dias * DIA_MS);
}

@Injectable()
export class AvaliacoesService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AvaliacoesService.name);
  private lembretesTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {}

  // Mesmo padrão da limpeza de OcorrenciasService: roda ao subir e depois a
  // cada hora, com `.unref()` para não segurar o encerramento do processo.
  onModuleInit(): void {
    void this.enviarLembretes();
    this.lembretesTimer = setInterval(
      () => void this.enviarLembretes(),
      INTERVALO_LEMBRETES_MS,
    );
    this.lembretesTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.lembretesTimer) clearInterval(this.lembretesTimer);
  }

  // Avaliações do cliente para os produtos de um pedido dele, e a partir de
  // quando ele pode avaliar.
  async listarDoPedido(
    pedidoId: number,
    user: UsuarioAutenticado,
  ): Promise<AvaliacoesDoPedido> {
    const pedido = await this.pedidoDoCliente(pedidoId, user);
    const avaliacoes = await this.prisma.avaliacao.findMany({
      where: { pedidoId },
      orderBy: { produtoId: 'asc' },
    });
    return {
      liberadaEm: dataLiberacaoAvaliacao(pedido),
      avaliacoes: avaliacoes.map((a) => ({
        produtoId: a.produtoId,
        nota: a.nota,
        comentario: a.comentario,
        status: a.status as StatusAvaliacao,
        atualizadaEm: a.atualizadaEm,
      })),
    };
  }

  // Cria ou edita a avaliação de um produto do pedido. Só a partir da data
  // prevista de entrega; editar volta para PENDENTE (o Admin aprova de novo).
  async salvar(
    pedidoId: number,
    produtoId: number,
    dto: SalvarAvaliacaoDto,
    user: UsuarioAutenticado,
  ): Promise<AvaliacaoDoCliente> {
    const pedido = await this.pedidoDoCliente(pedidoId, user);
    const liberadaEm = dataLiberacaoAvaliacao(pedido);
    if (!liberadaEm) {
      throw new BadRequestException(
        'Só é possível avaliar os produtos de um pedido pago e já enviado.',
      );
    }
    if (liberadaEm.getTime() > Date.now()) {
      throw new BadRequestException(
        `A avaliação fica disponível a partir de ${liberadaEm.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`,
      );
    }
    if (!pedido.itens.some((item) => item.produtoId === produtoId)) {
      throw new NotFoundException('Este produto não faz parte do pedido.');
    }

    const usuario = await this.prisma.usuario.findUnique({
      where: { id: user.id },
      select: { nome: true },
    });
    const comentario = dto.comentario?.trim() || null;

    const avaliacao = await this.prisma.avaliacao.upsert({
      where: { pedidoId_produtoId: { pedidoId, produtoId } },
      create: {
        pedidoId,
        produtoId,
        usuarioId: user.id,
        nomeExibicao: nomeParaExibicao(usuario?.nome ?? ''),
        nota: dto.nota,
        comentario,
      },
      update: { nota: dto.nota, comentario, status: StatusAvaliacao.PENDENTE },
    });

    return {
      produtoId: avaliacao.produtoId,
      nota: avaliacao.nota,
      comentario: avaliacao.comentario,
      status: avaliacao.status as StatusAvaliacao,
      atualizadaEm: avaliacao.atualizadaEm,
    };
  }

  // Página do produto: só as aprovadas, e a média delas.
  async resumoPublico(slug: string): Promise<ResumoAvaliacoes> {
    const produto = await this.prisma.produto.findFirst({
      where: { slug, ativo: true },
      select: { id: true },
    });
    if (!produto) {
      throw new NotFoundException('Produto não encontrado.');
    }

    const where = { produtoId: produto.id, status: StatusAvaliacao.APROVADA };
    const [agregado, avaliacoes] = await Promise.all([
      this.prisma.avaliacao.aggregate({
        where,
        _avg: { nota: true },
        _count: { _all: true },
      }),
      this.prisma.avaliacao.findMany({
        where,
        orderBy: { criadaEm: 'desc' },
        take: LIMITE_AVALIACOES_PUBLICAS,
      }),
    ]);

    const media = agregado._avg.nota;
    return {
      media: media === null ? null : Math.round(media * 10) / 10,
      total: agregado._count._all,
      avaliacoes: avaliacoes.map((a) => ({
        id: a.id,
        nomeExibicao: a.nomeExibicao,
        nota: a.nota,
        comentario: a.comentario,
        criadaEm: a.criadaEm,
      })),
    };
  }

  async listarParaAdmin(status?: StatusAvaliacao): Promise<AvaliacaoAdmin[]> {
    const registros = await this.prisma.avaliacao.findMany({
      where: status ? { status } : {},
      orderBy: [{ criadaEm: 'desc' }, { id: 'desc' }],
      take: 200,
      include: {
        produto: { select: { nome: true, slug: true } },
        pedido: { select: { numero: true } },
        usuario: { select: { email: true } },
      },
    });
    return registros.map((a) => ({
      id: a.id,
      produtoId: a.produtoId,
      produtoNome: a.produto.nome,
      produtoSlug: a.produto.slug,
      pedidoId: a.pedidoId,
      pedidoNumero: a.pedido.numero,
      nomeExibicao: a.nomeExibicao,
      clienteEmail: a.usuario?.email ?? null,
      nota: a.nota,
      comentario: a.comentario,
      status: a.status as StatusAvaliacao,
      criadaEm: a.criadaEm,
      atualizadaEm: a.atualizadaEm,
    }));
  }

  async atualizarStatus(
    id: number,
    status: StatusAvaliacao.APROVADA | StatusAvaliacao.RECUSADA,
  ): Promise<void> {
    const { count } = await this.prisma.avaliacao.updateMany({
      where: { id },
      data: { status },
    });
    if (count === 0) {
      throw new NotFoundException(`Avaliação ${id} não encontrada.`);
    }
  }

  // Pedidos com a avaliação liberada há DIAS_LEMBRETE dias, ainda sem
  // lembrete. A busca usa o prazo mínimo (o mais cedo possível) e o prazo de
  // cada pedido é conferido aqui; quem ainda não chegou na data fica para a
  // próxima rodada, sem ser marcado. Cada pedido é marcado ANTES do envio
  // (updateMany condicional): com mais de uma máquina rodando, só uma
  // consegue marcar e envia. Pedido já todo avaliado também é marcado, para
  // não voltar à busca. Nunca lança.
  async enviarLembretes(): Promise<void> {
    try {
      const agora = Date.now();
      const pedidos = await this.prisma.pedido.findMany({
        where: {
          status: StatusPedido.PAGO,
          statusEnvio: StatusEnvio.ENVIADO,
          enviadoEm: {
            lte: new Date(
              agora - (DIAS_MINIMOS_ENTREGA + DIAS_LEMBRETE_AVALIACAO) * DIA_MS,
            ),
          },
          lembreteAvaliacaoEm: null,
          usuarioId: { not: null },
        },
        orderBy: { enviadoEm: 'asc' },
        take: LOTE_LEMBRETES,
        select: {
          id: true,
          numero: true,
          status: true,
          statusEnvio: true,
          enviadoEm: true,
          fretePrazoDias: true,
          itens: { select: { produtoId: true } },
          avaliacoes: { select: { produtoId: true } },
          usuario: { select: { nome: true, email: true } },
        },
      });

      for (const pedido of pedidos) {
        const liberadaEm = dataLiberacaoAvaliacao(pedido);
        if (
          !liberadaEm ||
          liberadaEm.getTime() + DIAS_LEMBRETE_AVALIACAO * DIA_MS > agora
        ) {
          continue;
        }
        const { count } = await this.prisma.pedido.updateMany({
          where: { id: pedido.id, lembreteAvaliacaoEm: null },
          data: { lembreteAvaliacaoEm: new Date() },
        });
        const avaliados = new Set(pedido.avaliacoes.map((a) => a.produtoId));
        const falta = pedido.itens.some(
          (item) => !avaliados.has(item.produtoId),
        );
        if (count === 1 && falta && pedido.usuario) {
          await this.enviarLembrete(pedido.id, pedido.numero, pedido.usuario);
        }
      }
    } catch (erro) {
      this.logger.error(
        'Falha ao processar os lembretes de avaliação.',
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }

  private async enviarLembrete(
    pedidoId: number,
    numero: string,
    usuario: { nome: string; email: string },
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const link = frontendUrl
      ? `${frontendUrl.replace(/\/$/, '')}${CAMINHO_CONTA_PEDIDOS}/${pedidoId}`
      : null;
    const primeiroNome = escaparHtml(
      usuario.nome.trim().split(/\s+/)[0] || 'cliente',
    );

    await this.mailService.enviarEmail({
      to: usuario.email,
      subject: `Conte o que achou do seu pedido ${numero}`,
      html:
        `<p>Olá, ${primeiroNome}.</p>` +
        `<p>Esperamos que você esteja aproveitando os produtos do pedido <strong>${escaparHtml(numero)}</strong>.</p>` +
        '<p>Sua avaliação ajuda outras pessoas a escolher o aroma certo — leva menos de um minuto.</p>' +
        (link
          ? `<p><a href="${escaparHtml(link)}">Avaliar meus produtos</a></p>`
          : '<p>Acesse Minha Conta → Meus pedidos no site para avaliar.</p>') +
        '<p>Sensora</p>',
    });
  }

  // O pedido precisa ser do usuário do token (404 para o pedido de outra
  // pessoa, sem revelar que ele existe).
  private async pedidoDoCliente(pedidoId: number, user: UsuarioAutenticado) {
    const pedido = await this.prisma.pedido.findFirst({
      where: { id: pedidoId, usuarioId: user.id },
      select: {
        id: true,
        status: true,
        statusEnvio: true,
        enviadoEm: true,
        fretePrazoDias: true,
        itens: { select: { produtoId: true } },
      },
    });
    if (!pedido) {
      throw new NotFoundException('Pedido não encontrado.');
    }
    return pedido;
  }
}

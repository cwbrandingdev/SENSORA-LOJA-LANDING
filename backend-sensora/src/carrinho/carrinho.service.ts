import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { escaparHtml } from '../common/utils/html.util';
import { MailService } from '../mail/mail.service';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { PrismaService } from '../prisma/prisma.service';
import { SalvarCarrinhoDto } from './dto/salvar-carrinho.dto';
import { CarrinhoAbandonadoAdmin } from './entities/carrinho-abandonado-admin.entity';
import { Carrinho, ItemCarrinho } from './entities/carrinho.entity';

export const CARRINHO_ABANDONO_MINUTOS_PADRAO = 60;
const INTERVALO_LEMBRETES_MS = 15 * 60 * 1000;
const LOTE_LEMBRETES = 50;
const CAMINHO_CARRINHO = '/loja/carrinho';

type ItemEntrada = { produtoId: number; quantidade: number };

function assinatura(itens: ItemEntrada[]): string {
  return [...itens]
    .sort((a, b) => a.produtoId - b.produtoId)
    .map((item) => `${item.produtoId}:${item.quantidade}`)
    .join(',');
}

function consolidar(itens: ItemEntrada[]): ItemEntrada[] {
  const porId = new Map<number, number>();
  for (const item of itens) {
    porId.set(
      item.produtoId,
      (porId.get(item.produtoId) ?? 0) + item.quantidade,
    );
  }
  return [...porId.entries()].map(([produtoId, quantidade]) => ({
    produtoId,
    quantidade,
  }));
}

@Injectable()
export class CarrinhoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CarrinhoService.name);
  private readonly abandonoMinutos: number;
  private lembretesTimer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
  ) {
    this.abandonoMinutos =
      this.configService.get<number>('CARRINHO_ABANDONO_MINUTOS') ??
      CARRINHO_ABANDONO_MINUTOS_PADRAO;
  }

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

  async buscar(usuarioId: number): Promise<Carrinho> {
    const carrinho = await this.prisma.carrinho.findUnique({
      where: { usuarioId },
      include: {
        itens: {
          include: {
            produto: {
              select: {
                id: true,
                nome: true,
                slug: true,
                preco: true,
                imagemUrl: true,
                quantidade: true,
                ativo: true,
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    if (!carrinho) {
      return { itens: [] };
    }
    return { itens: this.paraItens(carrinho.itens) };
  }

  async salvar(usuarioId: number, dto: SalvarCarrinhoDto): Promise<Carrinho> {
    const consolidados = consolidar(dto.itens);
    const ids = consolidados.map((item) => item.produtoId);
    const produtos =
      ids.length === 0
        ? []
        : await this.prisma.produto.findMany({
            where: { id: { in: ids }, ativo: true },
            select: { id: true },
          });
    const validos = new Set(produtos.map((produto) => produto.id));
    const filtrados = consolidados.filter((item) => validos.has(item.produtoId));

    const existente = await this.prisma.carrinho.findUnique({
      where: { usuarioId },
      include: { itens: { select: { produtoId: true, quantidade: true } } },
    });
    const assinaturaAtual = assinatura(
      existente?.itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
      })) ?? [],
    );
    if (assinatura(filtrados) === assinaturaAtual) {
      return this.buscar(usuarioId);
    }

    const agora = new Date();
    if (!existente) {
      await this.prisma.carrinho.create({
        data: {
          usuarioId,
          atualizadoEm: agora,
          lembreteEnviadoEm: null,
          itens: { create: filtrados },
        },
      });
      return this.buscar(usuarioId);
    }

    await this.prisma.$transaction([
      this.prisma.itemCarrinho.deleteMany({
        where: { carrinhoId: existente.id },
      }),
      ...(filtrados.length > 0
        ? [
            this.prisma.itemCarrinho.createMany({
              data: filtrados.map((item) => ({
                carrinhoId: existente.id,
                produtoId: item.produtoId,
                quantidade: item.quantidade,
              })),
            }),
          ]
        : []),
      this.prisma.carrinho.update({
        where: { id: existente.id },
        data: { atualizadoEm: agora, lembreteEnviadoEm: null },
      }),
    ]);

    return this.buscar(usuarioId);
  }

  // Chamado depois do pagamento confirmado (CheckoutService). Nunca lança:
  // falha de limpeza não pode desfazer um Pedido já PAGO.
  async limparDoUsuario(usuarioId: number): Promise<void> {
    try {
      const carrinho = await this.prisma.carrinho.findUnique({
        where: { usuarioId },
        select: { id: true },
      });
      if (!carrinho) return;
      await this.prisma.$transaction([
        this.prisma.itemCarrinho.deleteMany({
          where: { carrinhoId: carrinho.id },
        }),
        this.prisma.carrinho.update({
          where: { id: carrinho.id },
          data: { lembreteEnviadoEm: null, atualizadoEm: new Date() },
        }),
      ]);
    } catch (erro) {
      this.logger.error(
        'Falha ao esvaziar o carrinho após o pagamento.',
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }

  // Sacolas no prazo do lembrete (ou já lembradas), sem Pedido PENDENTE —
  // quem está no checkout aparece na lista de pagamento, não aqui.
  async listarAbandonadosAdmin(): Promise<CarrinhoAbandonadoAdmin[]> {
    const limite = new Date(
      Date.now() - this.abandonoMinutos * 60 * 1000,
    );
    const carrinhos = await this.prisma.carrinho.findMany({
      where: {
        itens: { some: { produto: { ativo: true } } },
        OR: [
          { lembreteEnviadoEm: { not: null } },
          { atualizadoEm: { lte: limite } },
        ],
      },
      orderBy: { atualizadoEm: 'asc' },
      take: 200,
      include: {
        usuario: { select: { nome: true, email: true, telefone: true } },
        itens: {
          include: {
            produto: {
              select: { id: true, nome: true, preco: true, ativo: true },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
    });
    const usuarioIds = carrinhos.map((carrinho) => carrinho.usuarioId);
    const pendentes =
      usuarioIds.length === 0
        ? []
        : await this.prisma.pedido.findMany({
            where: {
              usuarioId: { in: usuarioIds },
              status: StatusPedido.PENDENTE,
            },
            select: { usuarioId: true },
          });
    const comCheckout = new Set(
      pendentes
        .map((pedido) => pedido.usuarioId)
        .filter((id): id is number => id != null),
    );

    return carrinhos
      .filter((carrinho) => !comCheckout.has(carrinho.usuarioId))
      .map((carrinho) => {
        const itens = carrinho.itens
          .filter((item) => item.produto.ativo)
          .map((item) => ({
            produtoId: item.produtoId,
            nome: item.produto.nome,
            quantidade: item.quantidade,
            preco: Number(item.produto.preco),
          }));
        return {
          usuarioId: carrinho.usuarioId,
          clienteNome: carrinho.usuario.nome,
          clienteEmail: carrinho.usuario.email,
          clienteTelefone: carrinho.usuario.telefone,
          itens,
          total: itens.reduce(
            (soma, item) => soma + item.preco * item.quantidade,
            0,
          ),
          paradoEm: carrinho.atualizadoEm,
          lembreteEnviadoEm: carrinho.lembreteEnviadoEm,
        };
      })
      .filter((carrinho) => carrinho.itens.length > 0);
  }

  // Sacolas com itens parados há abandonoMinutos, ainda sem lembrete. Marca
  // ANTES do envio (updateMany condicional) para duas máquinas não
  // duplicarem. Pedido PENDENTE (checkout aberto) não recebe este e-mail —
  // o cliente já está no pagamento. Nunca lança.
  async enviarLembretes(): Promise<void> {
    try {
      const limite = new Date(
        Date.now() - this.abandonoMinutos * 60 * 1000,
      );
      const carrinhos = await this.prisma.carrinho.findMany({
        where: {
          lembreteEnviadoEm: null,
          atualizadoEm: { lte: limite },
          itens: { some: {} },
        },
        orderBy: { atualizadoEm: 'asc' },
        take: LOTE_LEMBRETES,
        include: {
          usuario: { select: { nome: true, email: true } },
          itens: {
            include: {
              produto: { select: { nome: true, ativo: true } },
            },
          },
        },
      });

      for (const carrinho of carrinhos) {
        const pendente = await this.prisma.pedido.findFirst({
          where: {
            usuarioId: carrinho.usuarioId,
            status: StatusPedido.PENDENTE,
          },
          select: { id: true },
        });
        if (pendente) continue;

        const ativos = carrinho.itens.filter((item) => item.produto.ativo);
        const { count } = await this.prisma.carrinho.updateMany({
          where: { id: carrinho.id, lembreteEnviadoEm: null },
          data: { lembreteEnviadoEm: new Date() },
        });
        if (count !== 1 || ativos.length === 0 || !carrinho.usuario) {
          continue;
        }
        await this.enviarLembrete(
          carrinho.usuario,
          ativos.map((item) => item.produto.nome),
        );
      }
    } catch (erro) {
      this.logger.error(
        'Falha ao processar os lembretes de carrinho abandonado.',
        erro instanceof Error ? erro.stack : String(erro),
      );
    }
  }

  private async enviarLembrete(
    usuario: { nome: string; email: string },
    nomes: string[],
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const link = frontendUrl
      ? `${frontendUrl.replace(/\/$/, '')}${CAMINHO_CARRINHO}`
      : null;
    const primeiroNome = escaparHtml(
      usuario.nome.trim().split(/\s+/)[0] || 'cliente',
    );
    const itensHtml = nomes
      .map((nome) => `<li>${escaparHtml(nome)}</li>`)
      .join('');
    const lojaNome =
      this.configService.get<string>('LOJA_NOME')?.trim() || 'Sensora';

    await this.mailService.enviarEmail({
      to: usuario.email,
      subject: `Você esqueceu itens na sacola — ${lojaNome}`,
      html:
        `<p>Olá, ${primeiroNome}.</p>` +
        '<p>Você deixou itens na sacola e ainda não finalizou a compra:</p>' +
        `<ul>${itensHtml}</ul>` +
        (link
          ? `<p><a href="${escaparHtml(link)}">Voltar à sacola</a></p>`
          : '<p>Acesse a sacola no site para continuar.</p>') +
        `<p>${escaparHtml(lojaNome)}</p>`,
    });
  }

  private paraItens(
    itens: {
      produtoId: number;
      quantidade: number;
      produto: {
        nome: string;
        slug: string;
        preco: unknown;
        imagemUrl: string | null;
        quantidade: number;
        ativo: boolean;
      };
    }[],
  ): ItemCarrinho[] {
    return itens
      .filter((item) => item.produto.ativo)
      .map((item) => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        nome: item.produto.nome,
        slug: item.produto.slug,
        preco: Number(item.produto.preco),
        imagemUrl: item.produto.imagemUrl ?? undefined,
        estoqueConhecido: item.produto.quantidade,
      }));
  }
}

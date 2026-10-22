import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  MelhorEnvioService,
  type MelhorEnvioSituacao,
} from '../melhor-envio/melhor-envio.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatusEnvio } from './enums/status-envio.enum';
import { StatusPedido } from './enums/status-pedido.enum';

/** Prazo para confirmar recebimento automaticamente sem ação do cliente. */
export const DIAS_RECEBIMENTO_AUTOMATICO = 7;

const MS_POR_DIA = 24 * 60 * 60 * 1000;
const INTERVALO_SINCRONIZACAO_MS = 60 * 60 * 1000;
const LOTE_MELHOR_ENVIO = 40;

@Injectable()
export class PedidosRecebimentoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PedidosRecebimentoService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly melhorEnvioService: MelhorEnvioService,
  ) {}

  onModuleInit(): void {
    void this.executarRotinaPeriodica();
    this.timer = setInterval(
      () => void this.executarRotinaPeriodica(),
      INTERVALO_SINCRONIZACAO_MS,
    );
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async sincronizarPedido(pedidoId: number): Promise<void> {
    await this.confirmarPorMelhorEnvio(pedidoId);
    await this.confirmarPorPrazoDePedido(pedidoId);
  }

  /** Confirmação automática por prazo (7 dias) antes de listar pedidos do cliente. */
  async aplicarRecebimentoPorPrazoNaListagem(): Promise<void> {
    await this.confirmarPorPrazoEmLote();
  }

  async executarRotinaPeriodica(): Promise<void> {
    await this.confirmarPorPrazoEmLote();
    const pendentes = await this.prisma.pedido.findMany({
      where: {
        status: StatusPedido.PAGO,
        statusEnvio: StatusEnvio.ENVIADO,
        recebidoEm: null,
      },
      select: { id: true },
      take: LOTE_MELHOR_ENVIO,
      orderBy: { enviadoEm: 'asc' },
    });
    for (const { id } of pendentes) {
      await this.confirmarPorMelhorEnvio(id);
    }
  }

  private async confirmarPorPrazoEmLote(): Promise<void> {
    const limite = new Date(Date.now() - DIAS_RECEBIMENTO_AUTOMATICO * MS_POR_DIA);
    await this.prisma.pedido.updateMany({
      where: {
        status: StatusPedido.PAGO,
        statusEnvio: StatusEnvio.ENVIADO,
        recebidoEm: null,
        enviadoEm: { lte: limite },
      },
      data: { recebidoEm: new Date() },
    });
  }

  private async confirmarPorPrazoDePedido(pedidoId: number): Promise<void> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        status: true,
        statusEnvio: true,
        recebidoEm: true,
        enviadoEm: true,
      },
    });
    if (
      !pedido ||
      pedido.recebidoEm ||
      pedido.status !== StatusPedido.PAGO ||
      pedido.statusEnvio !== StatusEnvio.ENVIADO ||
      !pedido.enviadoEm
    ) {
      return;
    }
    const limite =
      pedido.enviadoEm.getTime() + DIAS_RECEBIMENTO_AUTOMATICO * MS_POR_DIA;
    if (Date.now() < limite) {
      return;
    }
    await this.gravarRecebimento(pedidoId, new Date());
  }

  private async confirmarPorMelhorEnvio(pedidoId: number): Promise<void> {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id: pedidoId },
      select: {
        status: true,
        statusEnvio: true,
        recebidoEm: true,
        etiquetaIdExterno: true,
        codigoRastreio: true,
      },
    });
    if (
      !pedido ||
      pedido.recebidoEm ||
      pedido.status !== StatusPedido.PAGO ||
      pedido.statusEnvio !== StatusEnvio.ENVIADO
    ) {
      return;
    }

    let situacao: MelhorEnvioSituacao | null = null;
    try {
      if (pedido.etiquetaIdExterno) {
        situacao = await this.melhorEnvioService.consultarEnvio(
          pedido.etiquetaIdExterno,
        );
      } else if (pedido.codigoRastreio) {
        situacao = await this.melhorEnvioService.pesquisarPedido(
          pedido.codigoRastreio,
        );
      }
    } catch (erro) {
      this.logger.debug(
        `Melhor Envio indisponível ao sincronizar recebimento do pedido ${pedidoId}.`,
        erro instanceof Error ? erro.message : String(erro),
      );
      return;
    }

    if (!situacao?.entregue) {
      return;
    }

    const quando = situacao.entregueEm ?? new Date();
    const gravado = await this.gravarRecebimento(pedidoId, quando);
    if (gravado && pedido.codigoRastreio !== situacao.codigoRastreio) {
      if (situacao.codigoRastreio) {
        await this.prisma.pedido.update({
          where: { id: pedidoId },
          data: { codigoRastreio: situacao.codigoRastreio },
        });
      }
    }
  }

  private async gravarRecebimento(
    pedidoId: number,
    recebidoEm: Date,
  ): Promise<boolean> {
    const resultado = await this.prisma.pedido.updateMany({
      where: {
        id: pedidoId,
        status: StatusPedido.PAGO,
        statusEnvio: StatusEnvio.ENVIADO,
        recebidoEm: null,
      },
      data: { recebidoEm },
    });
    return resultado.count > 0;
  }
}

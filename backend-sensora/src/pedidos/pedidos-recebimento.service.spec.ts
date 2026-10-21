import { Test, TestingModule } from '@nestjs/testing';
import { MelhorEnvioService } from '../melhor-envio/melhor-envio.service';
import { PrismaService } from '../prisma/prisma.service';
import { StatusEnvio } from './enums/status-envio.enum';
import { StatusPedido } from './enums/status-pedido.enum';
import {
  DIAS_RECEBIMENTO_AUTOMATICO,
  PedidosRecebimentoService,
} from './pedidos-recebimento.service';

describe('PedidosRecebimentoService', () => {
  let service: PedidosRecebimentoService;
  let prisma: {
    pedido: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let melhorEnvio: {
    consultarEnvio: jest.Mock;
    pesquisarPedido: jest.Mock;
  };

  beforeEach(async () => {
    prisma = {
      pedido: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
    };
    melhorEnvio = {
      consultarEnvio: jest.fn(),
      pesquisarPedido: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PedidosRecebimentoService,
        { provide: PrismaService, useValue: prisma },
        { provide: MelhorEnvioService, useValue: melhorEnvio },
      ],
    }).compile();

    service = module.get(PedidosRecebimentoService);
  });

  it('marca recebido quando o Melhor Envio informa entrega', async () => {
    prisma.pedido.findUnique.mockResolvedValue({
      status: StatusPedido.PAGO,
      statusEnvio: StatusEnvio.ENVIADO,
      recebidoEm: null,
      etiquetaIdExterno: 'ord-1',
      codigoRastreio: 'AA1',
    });
    melhorEnvio.consultarEnvio.mockResolvedValue({
      entregue: true,
      entregueEm: new Date('2026-10-01T12:00:00Z'),
      codigoRastreio: 'AA1',
    });

    await service.sincronizarPedido(5);

    expect(prisma.pedido.updateMany).toHaveBeenCalledWith({
      where: {
        id: 5,
        status: StatusPedido.PAGO,
        statusEnvio: StatusEnvio.ENVIADO,
        recebidoEm: null,
      },
      data: { recebidoEm: new Date('2026-10-01T12:00:00Z') },
    });
  });

  it('aplica prazo de 7 dias em lote', async () => {
    await service.aplicarRecebimentoPorPrazoNaListagem();

    const chamada = prisma.pedido.updateMany.mock.calls[0][0];
    expect(chamada.where.status).toBe(StatusPedido.PAGO);
    expect(chamada.where.recebidoEm).toBeNull();
    const limite = chamada.where.enviadoEm.lte as Date;
    const diffDias = Math.round(
      (Date.now() - limite.getTime()) / (24 * 60 * 60 * 1000),
    );
    expect(diffDias).toBe(DIAS_RECEBIMENTO_AUTOMATICO);
  });
});

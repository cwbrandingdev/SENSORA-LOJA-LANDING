import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { LIMIAR_ESTOQUE_BAIXO } from '../dashboard/constants/dashboard.constants';
import { MelhorEnvioService } from '../melhor-envio/melhor-envio.service';
import { StatusEnvio } from '../pedidos/enums/status-envio.enum';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { AlertasService } from './alertas.service';
import { LIMIAR_DIAS_PEDIDO_SEM_ENVIO } from './constants/alertas.constants';

// Vistoria de Alertas Operacionais (Admin) — testa só AlertasService.
// obterAlertas com PrismaService e MelhorEnvioService MOCKADOS (nenhum
// banco real, nenhuma chamada externa), mesmo padrão de
// dashboard.service.spec.ts: cada método usado é um jest.fn() isolado.
// `melhorEnvioService.estaConectado` é o único ponto de integração externa
// — e mesmo ele nunca faz rede aqui (é o service real que só lê banco,
// mockado só para não precisar de PrismaService real dentro dele).
function criarPrismaMock(overrides: {
  produtoCount?: jest.Mock;
  pedidoCount?: jest.Mock;
}) {
  return {
    produto: { count: overrides.produtoCount ?? jest.fn() },
    pedido: { count: overrides.pedidoCount ?? jest.fn() },
  };
}

async function criarService(opts: {
  produtoCount: jest.Mock;
  pedidoCount: jest.Mock;
  estaConectado: jest.Mock;
}): Promise<AlertasService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AlertasService,
      {
        provide: PrismaService,
        useValue: criarPrismaMock({
          produtoCount: opts.produtoCount,
          pedidoCount: opts.pedidoCount,
        }),
      },
      {
        provide: MelhorEnvioService,
        useValue: { estaConectado: opts.estaConectado },
      },
    ],
  }).compile();
  return module.get(AlertasService);
}

describe('AlertasService — obterAlertas', () => {
  // Achado da vistoria: loja saudável (nenhum produto sem estoque/baixo,
  // nenhum reembolso, nenhum pedido atrasado, Melhor Envio conectado) —
  // lista vazia é o estado normal, nunca tratado como erro nem como um
  // alerta com quantidade 0.
  it('sem nenhum problema: devolve lista vazia', async () => {
    const service = await criarService({
      produtoCount: jest.fn().mockResolvedValue(0),
      pedidoCount: jest.fn().mockResolvedValue(0),
      estaConectado: jest.fn().mockResolvedValue(true),
    });

    await expect(service.obterAlertas()).resolves.toEqual([]);
  });

  describe('ESTOQUE_BAIXO', () => {
    it('só produtos com estoque baixo (nenhum esgotado): severidade warning, quantidade soma os dois grupos', async () => {
      const produtoCount = jest
        .fn()
        .mockResolvedValueOnce(0) // semEstoque
        .mockResolvedValueOnce(3); // estoqueBaixo
      const service = await criarService({
        produtoCount,
        pedidoCount: jest.fn().mockResolvedValue(0),
        estaConectado: jest.fn().mockResolvedValue(true),
      });

      const alertas = await service.obterAlertas();

      expect(alertas).toEqual([
        {
          tipo: 'ESTOQUE_BAIXO',
          severidade: 'warning',
          titulo: 'Produtos com estoque baixo ou esgotado',
          quantidade: 3,
          link: '/workspace-x/produtos',
        },
      ]);
      // Segunda chamada de produto.count usa o limiar já centralizado no
      // Dashboard — nunca um número reinventado aqui.
      expect(produtoCount).toHaveBeenNthCalledWith(2, {
        where: { ativo: true, quantidade: { gt: 0, lte: LIMIAR_ESTOQUE_BAIXO } },
      });
    });

    it('algum produto esgotado (quantidade 0): severidade danger', async () => {
      const service = await criarService({
        produtoCount: jest
          .fn()
          .mockResolvedValueOnce(2) // semEstoque
          .mockResolvedValueOnce(1), // estoqueBaixo
        pedidoCount: jest.fn().mockResolvedValue(0),
        estaConectado: jest.fn().mockResolvedValue(true),
      });

      const alertas = await service.obterAlertas();

      expect(alertas).toHaveLength(1);
      expect(alertas[0]).toMatchObject({
        tipo: 'ESTOQUE_BAIXO',
        severidade: 'danger',
        quantidade: 3,
      });
    });

    it('nenhum produto em alerta: item não aparece na lista', async () => {
      const service = await criarService({
        produtoCount: jest.fn().mockResolvedValue(0),
        pedidoCount: jest.fn().mockResolvedValue(0),
        estaConectado: jest.fn().mockResolvedValue(true),
      });

      const alertas = await service.obterAlertas();

      expect(alertas.find((a) => a.tipo === 'ESTOQUE_BAIXO')).toBeUndefined();
    });
  });

  describe('REEMBOLSO_SOLICITADO', () => {
    it('pedidos com REEMBOLSO_SOLICITADO: severidade danger, link para Pedidos', async () => {
      const pedidoCount = jest
        .fn()
        .mockResolvedValueOnce(2) // reembolsosSolicitados
        .mockResolvedValueOnce(0); // pedidosAguardandoEnvio
      const service = await criarService({
        produtoCount: jest.fn().mockResolvedValue(0),
        pedidoCount,
        estaConectado: jest.fn().mockResolvedValue(true),
      });

      const alertas = await service.obterAlertas();

      expect(alertas).toEqual([
        {
          tipo: 'REEMBOLSO_SOLICITADO',
          severidade: 'danger',
          titulo: 'Reembolsos solicitados aguardando confirmação',
          quantidade: 2,
          link: '/workspace-x/pedidos',
        },
      ]);
      expect(pedidoCount).toHaveBeenNthCalledWith(1, {
        where: { status: StatusPedido.REEMBOLSO_SOLICITADO },
      });
    });
  });

  describe('PEDIDO_AGUARDANDO_ENVIO', () => {
    it('pedidos PAGO + NAO_ENVIADO há mais de LIMIAR_DIAS_PEDIDO_SEM_ENVIO dias: severidade warning', async () => {
      const pedidoCount = jest
        .fn()
        .mockResolvedValueOnce(0) // reembolsosSolicitados
        .mockResolvedValueOnce(5); // pedidosAguardandoEnvio
      const service = await criarService({
        produtoCount: jest.fn().mockResolvedValue(0),
        pedidoCount,
        estaConectado: jest.fn().mockResolvedValue(true),
      });

      const alertas = await service.obterAlertas();

      expect(alertas).toEqual([
        {
          tipo: 'PEDIDO_AGUARDANDO_ENVIO',
          severidade: 'warning',
          titulo: `Pedidos pagos há mais de ${LIMIAR_DIAS_PEDIDO_SEM_ENVIO} dias aguardando envio`,
          quantidade: 5,
          link: '/workspace-x/pedidos',
        },
      ]);

      // A query usa status PAGO + statusEnvio NAO_ENVIADO + data <= agora -
      // LIMIAR_DIAS_PEDIDO_SEM_ENVIO dias — nunca um número solto.
      const chamada = pedidoCount.mock.calls[1][0] as {
        where: { status: StatusPedido; statusEnvio: StatusEnvio; data: { lte: Date } };
      };
      expect(chamada.where.status).toBe(StatusPedido.PAGO);
      expect(chamada.where.statusEnvio).toBe(StatusEnvio.NAO_ENVIADO);

      const diferencaDias =
        (Date.now() - chamada.where.data.lte.getTime()) / (1000 * 60 * 60 * 24);
      expect(diferencaDias).toBeGreaterThanOrEqual(LIMIAR_DIAS_PEDIDO_SEM_ENVIO - 0.01);
      expect(diferencaDias).toBeLessThan(LIMIAR_DIAS_PEDIDO_SEM_ENVIO + 0.01);
    });
  });

  describe('MELHOR_ENVIO_DESCONECTADO', () => {
    it('Melhor Envio desconectado: alerta com quantidade 1, nunca chama o provedor (só o service real, sem fetch)', async () => {
      const estaConectado = jest.fn().mockResolvedValue(false);
      const service = await criarService({
        produtoCount: jest.fn().mockResolvedValue(0),
        pedidoCount: jest.fn().mockResolvedValue(0),
        estaConectado,
      });

      const alertas = await service.obterAlertas();

      expect(alertas).toEqual([
        {
          tipo: 'MELHOR_ENVIO_DESCONECTADO',
          severidade: 'danger',
          titulo: 'Melhor Envio desconectado — cotação de frete indisponível',
          quantidade: 1,
          link: '/workspace-x/integracoes',
        },
      ]);
      expect(estaConectado).toHaveBeenCalledTimes(1);
    });

    it('Melhor Envio conectado: nenhum alerta deste tipo', async () => {
      const service = await criarService({
        produtoCount: jest.fn().mockResolvedValue(0),
        pedidoCount: jest.fn().mockResolvedValue(0),
        estaConectado: jest.fn().mockResolvedValue(true),
      });

      const alertas = await service.obterAlertas();

      expect(alertas.find((a) => a.tipo === 'MELHOR_ENVIO_DESCONECTADO')).toBeUndefined();
    });
  });

  it('os 4 alertas simultaneamente: devolve os 4, cada um com seus próprios dados', async () => {
    const service = await criarService({
      produtoCount: jest
        .fn()
        .mockResolvedValueOnce(1) // semEstoque
        .mockResolvedValueOnce(2), // estoqueBaixo
      pedidoCount: jest
        .fn()
        .mockResolvedValueOnce(4) // reembolsosSolicitados
        .mockResolvedValueOnce(6), // pedidosAguardandoEnvio
      estaConectado: jest.fn().mockResolvedValue(false),
    });

    const alertas = await service.obterAlertas();

    expect(alertas).toHaveLength(4);
    expect(alertas.map((a) => a.tipo).sort()).toEqual(
      [
        'ESTOQUE_BAIXO',
        'MELHOR_ENVIO_DESCONECTADO',
        'PEDIDO_AGUARDANDO_ENVIO',
        'REEMBOLSO_SOLICITADO',
      ].sort(),
    );
  });
});

import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AsaasService } from '../asaas/asaas.service';
import { CarrinhoService } from '../carrinho/carrinho.service';
import { DevolucoesService } from '../devolucoes/devolucoes.service';
import { EnderecosService } from '../enderecos/enderecos.service';
import { MailService } from '../mail/mail.service';
import { MelhorEnvioService } from '../melhor-envio/melhor-envio.service';
import { OcorrenciasService } from '../ocorrencias/ocorrencias.service';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutosService } from '../produtos/produtos.service';
import { UsuariosService } from '../usuarios/usuarios.service';
import {
  CHECKOUT_ABANDONO_MINUTOS_PADRAO,
  CHECKOUT_PENDENTE_EXPIRA_MINUTOS_PADRAO,
  CheckoutService,
} from './checkout.service';

const primeiraChamada = (mock: jest.Mock): unknown =>
  (mock.mock.calls as unknown[][])[0][0];

const PEDIDO_ABANDONADO = {
  id: 42,
  numero: 'PED-42',
  data: new Date(Date.now() - 90 * 60 * 1000),
  clienteNome: 'Ana Souza',
  clienteEmail: 'ana@sensora.dev',
};

describe('CheckoutService — lembrete de checkout PENDENTE', () => {
  let prisma: {
    pedido: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let enviarEmail: jest.Mock;
  let listarCarrinhos: jest.Mock;
  let service: CheckoutService;

  beforeEach(async () => {
    prisma = {
      pedido: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    enviarEmail = jest.fn();
    listarCarrinhos = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        {
          provide: ConfigService,
          useValue: {
            get: (chave: string) => {
              if (chave === 'CHECKOUT_GATEWAY') return 'asaas';
              if (chave === 'FRONTEND_URL') {
                return 'https://www.sensorahome.com.br/';
              }
              if (chave === 'LOJA_NOME') return 'Sensora';
              if (chave === 'CHECKOUT_ABANDONO_MINUTOS') {
                return CHECKOUT_ABANDONO_MINUTOS_PADRAO;
              }
              if (chave === 'CHECKOUT_PENDENTE_EXPIRA_MINUTOS') {
                return CHECKOUT_PENDENTE_EXPIRA_MINUTOS_PADRAO;
              }
              return undefined;
            },
          },
        },
        { provide: PrismaService, useValue: prisma },
        { provide: ProdutosService, useValue: {} },
        { provide: EnderecosService, useValue: {} },
        { provide: AsaasService, useValue: {} },
        { provide: UsuariosService, useValue: {} },
        { provide: MelhorEnvioService, useValue: {} },
        { provide: DevolucoesService, useValue: {} },
        { provide: MailService, useValue: { enviarEmail } },
        { provide: OcorrenciasService, useValue: {} },
        {
          provide: CarrinhoService,
          useValue: { listarAbandonadosAdmin: listarCarrinhos },
        },
      ],
    }).compile();

    service = module.get(CheckoutService);
  });

  describe('enviarLembretesCheckout', () => {
    it('marca antes e envia o e-mail com o link do pedido', async () => {
      prisma.pedido.findMany.mockResolvedValueOnce([PEDIDO_ABANDONADO]);

      await service.enviarLembretesCheckout();

      const filtro = primeiraChamada(prisma.pedido.findMany) as {
        where: {
          status: StatusPedido;
          lembreteCheckoutEm: null;
          clienteEmail: { not: null };
          data: { lte: Date; gt: Date };
        };
      };
      expect(filtro.where.status).toBe(StatusPedido.PENDENTE);
      expect(filtro.where.lembreteCheckoutEm).toBeNull();
      expect(filtro.where.clienteEmail).toEqual({ not: null });
      const minutosAbandono =
        (Date.now() - filtro.where.data.lte.getTime()) / 60_000;
      expect(Math.round(minutosAbandono)).toBe(
        CHECKOUT_ABANDONO_MINUTOS_PADRAO,
      );
      const minutosExpiracao =
        (Date.now() - filtro.where.data.gt.getTime()) / 60_000;
      expect(Math.round(minutosExpiracao)).toBe(
        CHECKOUT_PENDENTE_EXPIRA_MINUTOS_PADRAO,
      );
      expect(prisma.pedido.updateMany).toHaveBeenCalledTimes(1);
      expect(enviarEmail).toHaveBeenCalledTimes(1);
      const email = primeiraChamada(enviarEmail) as {
        to: string;
        subject: string;
        html: string;
      };
      expect(email.to).toBe('ana@sensora.dev');
      expect(email.subject).toBe(
        'Você deixou um pagamento em aberto — Sensora',
      );
      expect(email.html).toContain('PED-42');
      expect(email.html).toContain(
        'https://www.sensorahome.com.br/conta/pedidos/42',
      );
    });

    it('pedido recente: a busca corta em 1h, então não entra na lista', async () => {
      await service.enviarLembretesCheckout();

      const filtro = primeiraChamada(prisma.pedido.findMany) as {
        where: { data: { lte: Date } };
      };
      const minutos =
        (Date.now() - filtro.where.data.lte.getTime()) / 60_000;
      expect(Math.round(minutos)).toBe(CHECKOUT_ABANDONO_MINUTOS_PADRAO);
      expect(enviarEmail).not.toHaveBeenCalled();
    });

    it('outra máquina já marcou: não envia de novo', async () => {
      prisma.pedido.findMany.mockResolvedValueOnce([PEDIDO_ABANDONADO]);
      prisma.pedido.updateMany.mockResolvedValueOnce({ count: 0 });

      await service.enviarLembretesCheckout();

      expect(enviarEmail).not.toHaveBeenCalled();
    });

    it('sem e-mail: marca para sair da busca, sem enviar', async () => {
      prisma.pedido.findMany.mockResolvedValueOnce([
        { ...PEDIDO_ABANDONADO, clienteEmail: '   ' },
      ]);

      await service.enviarLembretesCheckout();

      expect(prisma.pedido.updateMany).toHaveBeenCalledTimes(1);
      expect(enviarEmail).not.toHaveBeenCalled();
    });

    it('pedido já expirado: não marca nem envia', async () => {
      prisma.pedido.findMany.mockResolvedValueOnce([
        {
          ...PEDIDO_ABANDONADO,
          data: new Date(Date.now() - 25 * 60 * 60 * 1000),
        },
      ]);

      await service.enviarLembretesCheckout();

      expect(prisma.pedido.updateMany).not.toHaveBeenCalled();
      expect(enviarEmail).not.toHaveBeenCalled();
    });

    it('falha na busca não lança', async () => {
      prisma.pedido.findMany.mockRejectedValueOnce(new Error('banco fora'));
      await expect(service.enviarLembretesCheckout()).resolves.toBeUndefined();
    });
  });

  describe('listarPendentesAdmin', () => {
    const criadoEm = new Date(Date.now() - 90 * 60 * 1000);
    const pedidoPendente = {
      id: 42,
      numero: 'PED-42',
      total: 103.3,
      data: criadoEm,
      clienteNome: 'Ana Souza',
      clienteEmail: 'ana@sensora.dev',
      usuarioId: 7,
      lembreteCheckoutEm: null,
      usuario: { telefone: '41999998888' },
      itens: [
        {
          produtoId: 10,
          quantidade: 1,
          precoUnitario: 103.3,
          produto: { nome: 'Vela Lavanda' },
        },
      ],
    };

    function mockLista(pedidos: unknown[]) {
      prisma.pedido.findMany.mockImplementation(
        (query: { select?: { asaasCheckoutId?: boolean } }) => {
          if (query?.select?.asaasCheckoutId) {
            return Promise.resolve([]);
          }
          return Promise.resolve(pedidos);
        },
      );
    }

    it('devolve PENDENTE dentro do TTL, com itens, telefone e lembrete', async () => {
      mockLista([pedidoPendente]);

      const lista = await service.listarPendentesAdmin();

      expect(lista).toHaveLength(1);
      expect(lista[0]).toMatchObject({
        id: 'checkout-42',
        tipo: 'CHECKOUT',
        pedidoId: 42,
        numero: 'PED-42',
        total: 103.3,
        clienteNome: 'Ana Souza',
        clienteEmail: 'ana@sensora.dev',
        clienteTelefone: '41999998888',
        usuarioId: 7,
        lembreteEnviadoEm: null,
      });
      expect(lista[0].itens).toEqual([
        {
          produtoId: 10,
          nome: 'Vela Lavanda',
          quantidade: 1,
          preco: 103.3,
        },
      ]);
      expect(lista[0].minutosRestantes).toBeGreaterThan(20 * 60);
      const filtro = prisma.pedido.findMany.mock.calls
        .map((chamada) => chamada[0] as { where?: { status?: StatusPedido; data?: { gt?: Date } } })
        .find((query) => query.where?.data?.gt) as {
        where: { status: StatusPedido; data: { gt: Date } };
      };
      expect(filtro.where.status).toBe(StatusPedido.PENDENTE);
    });

    it('pedido já expirado na lista: fica de fora', async () => {
      mockLista([
        {
          ...pedidoPendente,
          id: 9,
          numero: 'PED-9',
          total: 10,
          data: new Date(Date.now() - 25 * 60 * 60 * 1000),
          usuario: { telefone: null },
          itens: [],
        },
      ]);

      await expect(service.listarPendentesAdmin()).resolves.toEqual([]);
    });

    it('junta sacola abandonada com checkout, sem duplicar quem já está no pagamento', async () => {
      mockLista([pedidoPendente]);
      listarCarrinhos.mockResolvedValueOnce([
        {
          usuarioId: 7,
          clienteNome: 'Ana Souza',
          clienteEmail: 'ana@sensora.dev',
          clienteTelefone: '41999998888',
          itens: [
            {
              produtoId: 10,
              nome: 'Vela Lavanda',
              quantidade: 1,
              preco: 59.9,
            },
          ],
          total: 59.9,
          paradoEm: criadoEm,
          minutosParado: 90,
          lembreteEnviadoEm: null,
        },
        {
          usuarioId: 8,
          clienteNome: 'Bruno Lima',
          clienteEmail: 'bruno@sensora.dev',
          clienteTelefone: '41988887777',
          itens: [
            {
              produtoId: 11,
              nome: 'Vela Rosas',
              quantidade: 2,
              preco: 49,
            },
          ],
          total: 98,
          paradoEm: new Date(criadoEm.getTime() - 60 * 60 * 1000),
          minutosParado: 150,
          lembreteEnviadoEm: new Date(),
        },
      ]);

      const lista = await service.listarPendentesAdmin();

      expect(lista.map((item) => item.id)).toEqual([
        'carrinho-8',
        'checkout-42',
      ]);
      expect(lista[0]).toMatchObject({
        tipo: 'CARRINHO',
        clienteNome: 'Bruno Lima',
        clienteEmail: 'bruno@sensora.dev',
        clienteTelefone: '41988887777',
        pedidoId: null,
      });
    });
  });
});

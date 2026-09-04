import { Test, TestingModule } from '@nestjs/testing';
import { UsuarioAutenticado } from '../auth/interfaces/usuario-autenticado.interface';
import { PedidosService } from '../pedidos/pedidos.service';
import { StatusPedido } from '../pedidos/enums/status-pedido.enum';
import { PrismaService } from '../prisma/prisma.service';
import { ProdutosService } from '../produtos/produtos.service';
import { PerfilUsuario } from '../usuarios/enums/perfil-usuario.enum';
import { UpdateItemPedidoDto } from './dto/update-item-pedido.dto';
import { ItensPedidoController } from './itens-pedido.controller';
import { ItensPedidoService } from './itens-pedido.service';

// Etapa 8.1 (HIGH-01 — "Admin order CRUD can fabricate PAGO" — e o
// complemento que eliminou completamente a venda manual) — prova que:
// (1) ItensPedidoService.create() não existe mais — não há como montar uma
// venda item a item pela área administrativa (os itens de um Pedido nascem
// exclusivamente dentro de CheckoutService.createSession, gravados via
// Prisma junto com o próprio Pedido, nunca por este service); e (2)
// update() nunca grava um `precoUnitario` vindo do cliente — o preço
// persistido é SEMPRE derivado de ProdutosService.findOne(produtoId).preco
// (mesma fonte de verdade que o Checkout já usa) ou preservado do valor já
// confiável gravado no item, nunca de um valor no corpo da requisição.
// `as unknown as UpdateItemPedidoDto` simula um bypass do DTO (que já não
// whitelist mais `precoUnitario`) para provar que a defesa é do SERVICE,
// não só da validação HTTP (main.ts#ValidationPipe forbidNonWhitelisted).

const VENDEDOR: UsuarioAutenticado = {
  id: 50,
  email: 'vendedor@sensora.dev',
  perfil: PerfilUsuario.VENDEDOR,
};

describe('ItensPedidoService — create removido / update com preço confiável (Etapa 8.1)', () => {
  let service: ItensPedidoService;
  let prisma: {
    itemPedido: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
  };
  let pedidosService: {
    findOne: jest.Mock;
    garantirMutavel: jest.Mock;
  };
  let produtosService: {
    findOne: jest.Mock;
    removerEstoque: jest.Mock;
    adicionarEstoque: jest.Mock;
  };

  const pedidoPendente = {
    id: 1,
    usuarioId: VENDEDOR.id,
    status: StatusPedido.PENDENTE,
  };

  beforeEach(async () => {
    prisma = {
      itemPedido: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
          id: 1,
          ...data,
        })),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
          id: 1,
          pedidoId: 1,
          produtoId: 10,
          quantidade: 2,
          precoUnitario: 19.9,
          subtotal: 39.8,
          ...data,
        })),
        findUnique: jest.fn(() => ({
          id: 1,
          pedidoId: 1,
          produtoId: 10,
          quantidade: 2,
          precoUnitario: 19.9,
          subtotal: 39.8,
        })),
        delete: jest.fn(),
      },
    };

    pedidosService = {
      findOne: jest.fn(() => ({ ...pedidoPendente })),
      garantirMutavel: jest.fn(),
    };

    produtosService = {
      findOne: jest.fn((id: number) => ({
        id,
        // Preço ATUAL do produto no "banco" — deliberadamente diferente de
        // qualquer valor que os testes tentem injetar via DTO, para provar
        // que é este valor (nunca o do cliente) que acaba persistido.
        preco: 19.9,
        quantidade: 100,
      })),
      removerEstoque: jest.fn(),
      adicionarEstoque: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ItensPedidoService,
        { provide: PrismaService, useValue: prisma },
        { provide: PedidosService, useValue: pedidosService },
        { provide: ProdutosService, useValue: produtosService },
      ],
    }).compile();

    service = module.get(ItensPedidoService);
  });

  // Caso B (complemento — eliminação da venda manual) — não existe mais
  // montagem administrativa de item: ItensPedidoService não tem método
  // `create`, e ItensPedidoController não tem handler `create` nem rota
  // POST "" — uma chamada HTTP direta a POST /itens-pedido falha porque a
  // operação não existe mais no controller (404 do próprio Nest, rota
  // nunca registrada), não porque um valor foi filtrado.
  it('Caso B: ItensPedidoService não expõe mais create() — montagem administrativa de item não existe', () => {
    expect((service as unknown as { create?: unknown }).create).toBeUndefined();
    expect(prisma.itemPedido.create).not.toHaveBeenCalled();
  });

  it('Caso B: ItensPedidoController não expõe mais handler create() — POST /itens-pedido não existe', () => {
    expect(
      (ItensPedidoController.prototype as unknown as { create?: unknown })
        .create,
    ).toBeUndefined();
  });

  it('update(): preço injetado no payload é ignorado quando o produto do item não muda — mantém o preço já gravado', async () => {
    const dtoComBypass = {
      quantidade: 2,
      precoUnitario: 0.01,
    } as unknown as UpdateItemPedidoDto;

    const resultado = await service.update(1, dtoComBypass, VENDEDOR);

    expect(produtosService.findOne).not.toHaveBeenCalled();
    expect(resultado.precoUnitario).toBe(19.9);
    expect(prisma.itemPedido.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: expect.objectContaining({ precoUnitario: 19.9 }),
    });
  });

  it('update(): ao trocar de produto, o preço passa a ser o preço ATUAL do novo produto (nunca o do payload)', async () => {
    produtosService.findOne.mockImplementation((id: number) => ({
      id,
      preco: id === 20 ? 55.5 : 19.9,
      quantidade: 100,
    }));

    const dtoComBypass = {
      produtoId: 20,
      precoUnitario: 0.01,
    } as unknown as UpdateItemPedidoDto;

    const resultado = await service.update(1, dtoComBypass, VENDEDOR);

    expect(produtosService.findOne).toHaveBeenCalledWith(20);
    expect(resultado.precoUnitario).toBe(55.5);
    expect(resultado.subtotal).toBe(2 * 55.5);
  });

  it('update(): pedido já finalizado (PAGO/CANCELADO) continua bloqueado — sem regressão da imutabilidade', async () => {
    pedidosService.garantirMutavel.mockImplementationOnce(() => {
      throw new Error('Pedido com status PAGO não pode ser alterado.');
    });

    await expect(
      service.update(1, { quantidade: 5 }, VENDEDOR),
    ).rejects.toThrow('Pedido com status PAGO não pode ser alterado.');
    expect(prisma.itemPedido.update).not.toHaveBeenCalled();
  });

  it('remove(): continua funcionando e devolvendo o estoque (gerenciamento legítimo de item existente)', async () => {
    await service.remove(1, VENDEDOR);

    expect(produtosService.adicionarEstoque).toHaveBeenCalledWith(10, 2);
    expect(prisma.itemPedido.findUnique).toHaveBeenCalled();
  });
});

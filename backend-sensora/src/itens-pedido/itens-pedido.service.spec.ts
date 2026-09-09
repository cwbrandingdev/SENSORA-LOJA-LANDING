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
    $transaction: jest.Mock;
  };
  let pedidosService: {
    findOne: jest.Mock;
    garantirMutavel: jest.Mock;
    recalcularTotal: jest.Mock;
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
    const itemPedido = {
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
    };

    prisma = {
      itemPedido,
      // Etapa 8.8 — update()/remove() rodam a escrita do item + o
      // recálculo de Pedido.total (via pedidosService.recalcularTotal, já
      // mockado abaixo) dentro de uma transação. Para este teste unitário
      // não precisamos simular isolamento real do Postgres — só que o
      // callback recebe um `tx` com os mesmos métodos de itemPedido, para
      // que `tx.itemPedido.update`/`.delete` cheguem às mesmas mocks acima.
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) =>
        callback({ itemPedido }),
      ),
    };

    pedidosService = {
      findOne: jest.fn(() => ({ ...pedidoPendente })),
      garantirMutavel: jest.fn(),
      // Etapa 8.8 — mockado como no-op: os testes deste arquivo continuam
      // focados em preço confiável/estoque (Etapa 8.1); a prova de que
      // recalcularTotal() é realmente chamado com o(s) pedidoId(s) certo(s)
      // fica em testes dedicados logo abaixo.
      recalcularTotal: jest.fn(() => ({})),
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

    // Etapa 10 / PED-01 — adicionarEstoque() agora roda dentro do
    // $transaction, recebendo o `tx` (não mais o `this.prisma` default) —
    // por isso o terceiro argumento passa a fazer parte da chamada
    // esperada. Ver describe PED-01 abaixo para os testes dedicados de
    // atomicidade.
    expect(produtosService.adicionarEstoque).toHaveBeenCalledWith(
      10,
      2,
      expect.objectContaining({ itemPedido: expect.anything() }),
    );
    expect(prisma.itemPedido.findUnique).toHaveBeenCalled();
  });

  // Etapa 8.8 (integridade financeira) — casos 2/4/5 do enunciado: alterar
  // quantidade e remover item precisam disparar o recálculo de
  // Pedido.total do pedido dono do item, dentro da mesma transação da
  // escrita do item (garante atomicidade sob concorrência — ver comentário
  // em itens-pedido.service.ts).
  it('update(): recalcula Pedido.total do pedido do item, dentro da mesma transação da escrita', async () => {
    await service.update(1, { quantidade: 5 }, VENDEDOR);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(pedidosService.recalcularTotal).toHaveBeenCalledTimes(1);
    expect(pedidosService.recalcularTotal).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ itemPedido: expect.anything() }),
    );
  });

  it('remove(): recalcula Pedido.total do pedido do item, dentro da mesma transação da exclusão', async () => {
    await service.remove(1, VENDEDOR);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(pedidosService.recalcularTotal).toHaveBeenCalledTimes(1);
    expect(pedidosService.recalcularTotal).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ itemPedido: expect.anything() }),
    );
  });

  // Etapa 8.8 — caso extra descoberto no diagnóstico: update() também
  // permite mover um item para OUTRO pedido (UpdateItemPedidoDto.pedidoId).
  // Os dois pedidos (origem e destino) ficam com listas de itens diferentes
  // depois do move, então os DOIS totais precisam ser recalculados — nunca
  // só o de destino.
  it('update(): ao mover o item para outro pedido, recalcula o total dos DOIS pedidos (origem e destino)', async () => {
    const pedidoDestino = { id: 2, usuarioId: VENDEDOR.id, status: StatusPedido.PENDENTE };
    pedidosService.findOne.mockImplementation((id: number) =>
      id === 2 ? { ...pedidoDestino } : { ...pedidoPendente },
    );

    const dto = { pedidoId: 2 } as unknown as UpdateItemPedidoDto;
    await service.update(1, dto, VENDEDOR);

    expect(pedidosService.recalcularTotal).toHaveBeenCalledTimes(2);
    expect(pedidosService.recalcularTotal).toHaveBeenCalledWith(
      2,
      expect.anything(),
    ); // destino
    expect(pedidosService.recalcularTotal).toHaveBeenCalledWith(
      1,
      expect.anything(),
    ); // origem (item.pedidoId original, do mock de itemPedido.findUnique)
  });
});

// Etapa 10 / PED-01 (achado da auditoria — estoque fora da transação) —
// suíte dedicada, com um mock de $transaction mais realista que o da suíte
// acima (que só encaminha o callback): aqui o mock também permite simular
// o `$transaction` REJEITANDO no meio do caminho (Cenário 2) e o ajuste de
// estoque lançando por falta de estoque (Cenário 3), para comprovar que:
// (1) os ajustes de estoque recebem o `tx`, não mais o client default; (2)
// uma falha depois do ajuste de estoque, mas ainda dentro do callback,
// rejeita a operação inteira (nível de código — a garantia de ROLLBACK real
// no Postgres vem do próprio `$transaction` do Prisma, já correto por
// construção quando tudo roda dentro do mesmo callback); (3) estoque
// insuficiente aborta antes de qualquer escrita do item ser tentada.
describe('ItensPedidoService — estoque dentro da transação (Etapa 10 / PED-01)', () => {
  let service: ItensPedidoService;
  let prisma: {
    itemPedido: {
      update: jest.Mock;
      findUnique: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let pedidosService: {
    findOne: jest.Mock;
    garantirMutavel: jest.Mock;
    recalcularTotal: jest.Mock;
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

  // Ordem de chamadas observada durante a execução de service.update()/
  // remove() — usada para provar que o ajuste de estoque acontece DENTRO do
  // callback do $transaction (depois de `$transaction` ser invocado), não
  // antes (o bug original: estoque em autocommit, $transaction só depois).
  let ordemDeChamadas: string[];

  beforeEach(async () => {
    ordemDeChamadas = [];

    const itemPedido = {
      update: jest.fn(({ data }: { data: Record<string, unknown> }) => {
        ordemDeChamadas.push('itemPedido.update');
        return { id: 1, pedidoId: 1, produtoId: 10, quantidade: 5, ...data };
      }),
      findUnique: jest.fn(() => ({
        id: 1,
        pedidoId: 1,
        produtoId: 10,
        quantidade: 2,
        precoUnitario: 19.9,
        subtotal: 39.8,
      })),
      delete: jest.fn(() => {
        ordemDeChamadas.push('itemPedido.delete');
      }),
    };

    prisma = {
      itemPedido,
      // Mock "de verdade" o suficiente para propagar uma rejeição do
      // callback como uma rejeição do próprio $transaction — é exatamente
      // o que o Prisma real faz (se o callback lança, a transação inteira
      // é revertida e $transaction rejeita com o mesmo erro).
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => {
        ordemDeChamadas.push('$transaction:aberta');
        return callback({ itemPedido });
      }),
    };

    pedidosService = {
      findOne: jest.fn(() => ({ ...pedidoPendente })),
      garantirMutavel: jest.fn(),
      recalcularTotal: jest.fn(() => {
        ordemDeChamadas.push('recalcularTotal');
        return {};
      }),
    };

    produtosService = {
      findOne: jest.fn((id: number) => ({ id, preco: 19.9, quantidade: 100 })),
      removerEstoque: jest.fn(() => {
        ordemDeChamadas.push('removerEstoque');
        return {};
      }),
      adicionarEstoque: jest.fn(() => {
        ordemDeChamadas.push('adicionarEstoque');
        return {};
      }),
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

  // Cenário 1 — sucesso: pedido/item/estoque, tudo confirmado.
  it('Cenário 1 — update() com sucesso: estoque é ajustado, item é atualizado e o total é recalculado, tudo dentro da mesma transação', async () => {
    const resultado = await service.update(1, { quantidade: 5 }, VENDEDOR);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(produtosService.removerEstoque).toHaveBeenCalledWith(
      10,
      3, // diferença: 5 (nova) - 2 (antiga)
      expect.objectContaining({ itemPedido: expect.anything() }),
    );
    expect(prisma.itemPedido.update).toHaveBeenCalledTimes(1);
    expect(pedidosService.recalcularTotal).toHaveBeenCalledTimes(1);
    expect(resultado.quantidade).toBe(5);

    // A ordem prova que o ajuste de estoque acontece DEPOIS de
    // $transaction abrir (ou seja, dentro do callback) — nunca antes.
    expect(ordemDeChamadas).toEqual([
      '$transaction:aberta',
      'removerEstoque',
      'itemPedido.update',
      'recalcularTotal',
    ]);
  });

  it('Cenário 1 — remove() com sucesso: estoque é devolvido, item é excluído e o total é recalculado, tudo dentro da mesma transação', async () => {
    await service.remove(1, VENDEDOR);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(produtosService.adicionarEstoque).toHaveBeenCalledWith(
      10,
      2,
      expect.objectContaining({ itemPedido: expect.anything() }),
    );
    expect(ordemDeChamadas).toEqual([
      '$transaction:aberta',
      'adicionarEstoque',
      'itemPedido.delete',
      'recalcularTotal',
    ]);
  });

  // Cenário 2 — falha posterior (ainda dentro da transação): se a escrita
  // do item falhar DEPOIS do ajuste de estoque, mas dentro do mesmo
  // callback, a operação inteira precisa rejeitar — é essa rejeição do
  // callback que faz o Prisma reverter TUDO (estoque incluído) no Postgres
  // real. Não há como observar "o estoque voltou" num mock sem banco real;
  // a prova de nível de unidade é: (a) o ajuste de estoque e a escrita que
  // falha estão no MESMO callback (não em chamadas separadas antes/depois
  // de $transaction), e (b) a falha se propaga como rejeição de
  // service.update() como um todo, sem ser engolida em algum catch.
  it('Cenário 2 — falha posterior dentro da transação: erro em itemPedido.update() rejeita update() inteiro (estoque já ajustado participa do mesmo callback que falhou)', async () => {
    prisma.itemPedido.update.mockImplementationOnce(() => {
      ordemDeChamadas.push('itemPedido.update:falhou');
      throw new Error('falha simulada depois do ajuste de estoque');
    });

    await expect(
      service.update(1, { quantidade: 5 }, VENDEDOR),
    ).rejects.toThrow('falha simulada depois do ajuste de estoque');

    // O ajuste de estoque rodou (dentro do callback) antes da falha —
    // exatamente por estar no mesmo callback que falhou, o Prisma reverte
    // os dois juntos no Postgres real.
    expect(produtosService.removerEstoque).toHaveBeenCalledTimes(1);
    expect(ordemDeChamadas).toEqual([
      '$transaction:aberta',
      'removerEstoque',
      'itemPedido.update:falhou',
    ]);
    // recalcularTotal nunca chega a rodar — a falha interrompeu o callback
    // antes desse ponto.
    expect(pedidosService.recalcularTotal).not.toHaveBeenCalled();
  });

  it('Cenário 2 — falha posterior dentro da transação (remove()): erro em itemPedido.delete() rejeita remove() inteiro', async () => {
    prisma.itemPedido.delete.mockImplementationOnce(() => {
      ordemDeChamadas.push('itemPedido.delete:falhou');
      throw new Error('falha simulada depois de devolver o estoque');
    });

    await expect(service.remove(1, VENDEDOR)).rejects.toThrow(
      'falha simulada depois de devolver o estoque',
    );

    expect(produtosService.adicionarEstoque).toHaveBeenCalledTimes(1);
    expect(pedidosService.recalcularTotal).not.toHaveBeenCalled();
  });

  // Cenário 3 — estoque insuficiente: removerEstoque() já lança
  // BadRequestException atomicamente quando não há estoque suficiente (ver
  // ProdutosService) — a escrita do item nunca é sequer tentada, porque o
  // throw interrompe o callback antes de chegar lá.
  it('Cenário 3 — estoque insuficiente: removerEstoque() lança, itemPedido.update() nunca é chamado, nenhum recálculo de total acontece', async () => {
    const erroEstoqueInsuficiente = new Error(
      'Estoque insuficiente para o produto com id 10',
    );
    produtosService.removerEstoque.mockImplementationOnce(() => {
      ordemDeChamadas.push('removerEstoque:falhou');
      throw erroEstoqueInsuficiente;
    });

    await expect(
      service.update(1, { quantidade: 5 }, VENDEDOR),
    ).rejects.toThrow('Estoque insuficiente para o produto com id 10');

    expect(prisma.itemPedido.update).not.toHaveBeenCalled();
    expect(pedidosService.recalcularTotal).not.toHaveBeenCalled();
    expect(ordemDeChamadas).toEqual([
      '$transaction:aberta',
      'removerEstoque:falhou',
    ]);
  });

  // Confirma explicitamente que o `client` passado para removerEstoque/
  // adicionarEstoque é o `tx` da transação aberta, nunca o PrismaService
  // "cru" (this.prisma) — é essa troca que fecha o achado da auditoria.
  it('o `client` passado para removerEstoque/adicionarEstoque é sempre o `tx` — nunca this.prisma (PrismaService) diretamente', async () => {
    await service.update(1, { quantidade: 5 }, VENDEDOR);

    const clienteRecebido = produtosService.removerEstoque.mock.calls[0][2];
    expect(clienteRecebido).not.toBe(prisma);
    expect(clienteRecebido).toEqual({ itemPedido: expect.anything() });
  });
});

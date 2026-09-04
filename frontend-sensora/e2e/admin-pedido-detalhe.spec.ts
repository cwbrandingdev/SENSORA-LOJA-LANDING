import { test, expect, type Page } from "@playwright/test";

// Etapa 8.1 (complemento — eliminação da venda manual) — suíte E2E de
// /admin/pedidos/[id] dedicada a provar que "Adicionar item" foi removido
// (não existe mais forma de montar uma venda item a item pela área
// administrativa) e que o gerenciamento legítimo de itens JÁ existentes
// (editar quantidade/produto, remover) continua funcionando normalmente.
// Não existia nenhuma suíte E2E para esta página antes.

const TOKEN_KEY = "sensora_token";
const API_URL = "http://localhost:3000";

function base64Url(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fakeToken(): string {
  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const payload = base64Url({
    sub: 1,
    email: "admin@sensora.dev",
    perfil: "ADMIN",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.assinatura-fake`;
}

async function seedSession(page: Page) {
  await page.addInitScript(
    ([tokenKey, token]) => {
      window.localStorage.setItem(tokenKey, token);
    },
    [TOKEN_KEY, fakeToken()] as const,
  );
}

const PEDIDO = {
  id: 1,
  numero: "PED-1",
  data: "2026-09-01T00:00:00.000Z",
  status: "PENDENTE",
  statusEnvio: "NAO_ENVIADO",
  total: 39.8,
};

const ITEM = {
  id: 5,
  pedidoId: 1,
  produtoId: 10,
  quantidade: 2,
  precoUnitario: 19.9,
  subtotal: 39.8,
};

const PRODUTO = {
  id: 10,
  nome: "Vela Lavanda",
  slug: "vela-lavanda",
  preco: 19.9,
  quantidade: 50,
  ativo: true,
  destaque: false,
};

function mockPedidoDetalhe(
  page: Page,
  opts?: {
    itens?: Record<string, unknown>[];
    respostaPut?: { status: number; body: unknown };
  },
): { chamadasPutItem: Record<string, unknown>[]; chamadasDeleteItem: number[] } {
  const itens = opts?.itens ?? [ITEM];
  const chamadasPutItem: Record<string, unknown>[] = [];
  const chamadasDeleteItem: number[] = [];

  page.route(`${API_URL}/pedidos/${PEDIDO.id}/itens`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: { pedido: PEDIDO, itens, total: PEDIDO.total },
      });
      return;
    }
    await route.continue();
  });

  page.route(`${API_URL}/produtos`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: [PRODUTO] });
      return;
    }
    await route.continue();
  });

  page.route(`${API_URL}/pedidos/${PEDIDO.id}`, async (route) => {
    // Auto-sync de total (só dispara se pedidoComItens.total !== pedido.total,
    // o que não é o caso neste mock — 39.8 === 39.8) — nunca deveria ser
    // chamado nestes testes, mas mantemos a rota respondendo por segurança.
    if (route.request().method() === "PUT") {
      await route.fulfill({ json: PEDIDO });
      return;
    }
    await route.continue();
  });

  page.route(`${API_URL}/itens-pedido/${ITEM.id}`, async (route) => {
    if (route.request().method() === "PUT") {
      const corpo = route.request().postDataJSON() as Record<string, unknown>;
      chamadasPutItem.push(corpo);

      if (opts?.respostaPut) {
        await route.fulfill({
          status: opts.respostaPut.status,
          json: opts.respostaPut.body,
        });
        return;
      }

      await route.fulfill({ json: { ...ITEM, ...corpo } });
      return;
    }
    if (route.request().method() === "DELETE") {
      chamadasDeleteItem.push(ITEM.id);
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    await route.continue();
  });

  return { chamadasPutItem, chamadasDeleteItem };
}

test.describe("Admin / Pedido detalhe — eliminação da venda manual", () => {
  test("não existe mais o botão 'Adicionar item' — montagem administrativa de venda foi removida", async ({
    page,
  }) => {
    await seedSession(page);
    mockPedidoDetalhe(page);

    await page.goto(`/admin/pedidos/${PEDIDO.id}`);

    await expect(page.getByRole("heading", { name: `Pedido ${PEDIDO.numero}` })).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar item" })).toHaveCount(0);
  });

  test("formulário de item não expõe nenhum campo de preço unitário (não é possível fabricar preço)", async ({
    page,
  }) => {
    await seedSession(page);
    mockPedidoDetalhe(page);

    await page.goto(`/admin/pedidos/${PEDIDO.id}`);
    await page.getByRole("button", { name: "Editar" }).click();

    await expect(page.locator("#precoUnitario")).toHaveCount(0);
  });

  test("editar quantidade de um item existente continua funcionando (gerenciamento legítimo preservado)", async ({
    page,
  }) => {
    await seedSession(page);
    const { chamadasPutItem } = mockPedidoDetalhe(page);

    await page.goto(`/admin/pedidos/${PEDIDO.id}`);
    await page.getByRole("button", { name: "Editar" }).click();
    await page.locator("#quantidade").fill("3");
    await page.getByRole("button", { name: "Salvar item" }).click();

    await expect(page.getByText("Item do pedido atualizado com sucesso.")).toBeVisible();
    expect(chamadasPutItem).toHaveLength(1);
    expect(chamadasPutItem[0]).toMatchObject({ quantidade: 3 });
    expect(chamadasPutItem[0]).not.toHaveProperty("precoUnitario");
  });

  test("remover um item existente continua funcionando (gerenciamento legítimo preservado)", async ({ page }) => {
    await seedSession(page);
    const { chamadasDeleteItem } = mockPedidoDetalhe(page);

    await page.goto(`/admin/pedidos/${PEDIDO.id}`);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Remover" }).click();

    await expect(page.getByText("Item removido do pedido com sucesso.")).toBeVisible();
    expect(chamadasDeleteItem).toEqual([ITEM.id]);
  });
});

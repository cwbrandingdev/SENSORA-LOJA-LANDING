import { test, expect, type Page } from "@playwright/test";

// Para acompanhar (/workspace-x/pagamentos-em-aberto). A API é
// simulada pelo CAMINHO exato /admin/checkout/pendentes — um glob
// "**/checkout/pendentes" também casaria com GET /checkout/pendente do
// cliente. Mesmo padrão de e2e/mock-carrinho-api.ts (pathname ===).

const TOKEN_KEY = "sensora_token";
const LISTA_URL = "/workspace-x/pagamentos-em-aberto";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.hostname !== "localhost",
    (route) => route.abort(),
  );
});

function base64Url(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fakeToken(perfil: "ADMIN" | "VENDEDOR"): string {
  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const payload = base64Url({
    sub: 1,
    email: "admin@sensora.dev",
    perfil,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.assinatura-fake`;
}

async function seedSession(page: Page, perfil: "ADMIN" | "VENDEDOR" = "ADMIN") {
  await page.addInitScript(
    ([tokenKey, token]) => {
      window.localStorage.setItem(tokenKey, token);
    },
    [TOKEN_KEY, fakeToken(perfil)] as const,
  );
}

const CHECKOUT = {
  id: "checkout-42",
  tipo: "CHECKOUT" as const,
  clienteNome: "Ana Souza",
  clienteEmail: "ana@sensora.dev",
  clienteTelefone: "41999998888",
  usuarioId: 7,
  itens: [
    {
      produtoId: 10,
      nome: "Vela Lavanda",
      quantidade: 1,
      preco: 103.3,
    },
  ],
  total: 103.3,
  paradoEm: "2026-10-28T14:00:00.000Z",
  minutosParado: 90,
  lembreteEnviadoEm: null as string | null,
  pedidoId: 42,
  numero: "PED-42",
  minutosRestantes: 1200,
};

const CARRINHO = {
  id: "carrinho-8",
  tipo: "CARRINHO" as const,
  clienteNome: "Bruno Lima",
  clienteEmail: "bruno@sensora.dev",
  clienteTelefone: "41988887777",
  usuarioId: 8,
  itens: [
    {
      produtoId: 11,
      nome: "Vela Rosas",
      quantidade: 2,
      preco: 49,
    },
  ],
  total: 98,
  paradoEm: "2026-10-28T13:00:00.000Z",
  minutosParado: 150,
  lembreteEnviadoEm: "2026-10-28T15:10:00.000Z",
  pedidoId: null,
  numero: null,
  minutosRestantes: null,
};

async function mockPendentes(
  page: Page,
  lista: Array<typeof CHECKOUT | typeof CARRINHO> = [CHECKOUT],
) {
  await page.route(
    (url) => url.pathname === "/alertas",
    async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { ...CORS, "Content-Type": "application/json" },
          json: [],
        });
        return;
      }
      await route.fallback();
    },
  );
  await page.route(
    (url) => url.pathname === "/admin/checkout/pendentes",
    async (route) => {
      if (route.request().method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS });
        return;
      }
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { ...CORS, "Content-Type": "application/json" },
          json: lista,
        });
        return;
      }
      await route.fallback();
    },
  );
}

test.describe("Admin — Para acompanhar", () => {
  test("rota é alcançável pelo menu e lista o cliente com contato e itens", async ({
    page,
  }) => {
    await seedSession(page);
    await mockPendentes(page);

    await page.goto(LISTA_URL);

    await expect(page).toHaveURL(LISTA_URL);
    await expect(
      page.getByRole("navigation", { name: "Navegação administrativa" }).getByRole("link", {
        name: "Para acompanhar",
      }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Para acompanhar" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ana Souza" })).toBeVisible();
    await expect(page.getByText("ana@sensora.dev")).toBeVisible();
    await expect(page.getByText("PED-42")).toBeVisible();
    await expect(page.getByText("Vela Lavanda")).toBeVisible();
    await expect(page.getByText("R$ 103,30").first()).toBeVisible();
    await expect(page.getByText("Pagamento em aberto")).toBeVisible();
    const verPedido = page.getByRole("link", { name: "Ver pedido" });
    await expect(verPedido).toHaveAttribute("href", "/workspace-x/pedidos/42");
  });

  test("lista vazia mostra o estado vazio", async ({ page }) => {
    await seedSession(page);
    await mockPendentes(page, []);

    await page.goto(LISTA_URL);

    await expect(page.getByText("Ninguém para acompanhar")).toBeVisible();
  });

  test("sacola parada aparece com itens, e-mail e telefone", async ({ page }) => {
    await seedSession(page);
    await mockPendentes(page, [CARRINHO]);

    await page.goto(LISTA_URL);

    await expect(page.getByText("Sacola parada")).toBeVisible();
    await expect(page.getByRole("link", { name: "Bruno Lima" })).toBeVisible();
    await expect(page.getByText("bruno@sensora.dev")).toBeVisible();
    await expect(page.getByText("Vela Rosas")).toBeVisible();
    await expect(page.getByText("× 2")).toBeVisible();
    await expect(page.getByText("Lembrete enviado")).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver cliente" })).toHaveAttribute(
      "href",
      "/workspace-x/clientes/8",
    );
  });

  test("filtro Sacola esconde o pagamento em aberto", async ({ page }) => {
    await seedSession(page);
    await mockPendentes(page, [CHECKOUT, CARRINHO]);

    await page.goto(LISTA_URL);

    await expect(page.getByText("Ana Souza")).toBeVisible();
    await expect(page.getByText("Bruno Lima")).toBeVisible();

    await page.getByRole("button", { name: "Sacola (1)" }).click();

    await expect(page.getByText("Bruno Lima")).toBeVisible();
    await expect(page.getByText("Ana Souza")).toHaveCount(0);
  });

  test("VENDEDOR também vê o item no menu (mesmo acesso de Pedidos)", async ({
    page,
  }) => {
    await seedSession(page, "VENDEDOR");
    await mockPendentes(page);

    await page.goto(LISTA_URL);

    await expect(
      page.getByRole("navigation", { name: "Navegação administrativa" }).getByRole("link", {
        name: "Para acompanhar",
      }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Para acompanhar" })).toBeVisible();
  });
});

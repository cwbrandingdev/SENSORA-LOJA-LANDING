import { test, expect, type Page } from "@playwright/test";

// Etapa 6.6 (Status de Envio) — suíte E2E de "Meus Pedidos" (lista +
// detalhe) dedicada ao novo indicador de envio (📦 Aguardando envio /
// 🚚 Enviado) e à etapa nova na timeline (AcompanhamentoPedido.tsx). Mesmo
// padrão de mock via page.route do resto do projeto — nenhuma chamada real
// de API neste ambiente de teste.

const TOKEN_KEY = "sensora_token";

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
    email: "cliente@sensora.dev",
    perfil: "CLIENTE",
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

function pedidoBase(overrides: Record<string, unknown> = {}) {
  return {
    id: 10,
    numero: "PED-10",
    data: "2026-08-20T00:00:00.000Z",
    status: "PAGO",
    statusEnvio: "NAO_ENVIADO",
    enviadoEm: null,
    total: 149.9,
    ...overrides,
  };
}

async function mockListaMeusPedidos(page: Page, pedidos: Record<string, unknown>[]) {
  await page.route("**/pedidos/meus", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({ json: pedidos });
  });
}

async function mockDetalheMeuPedido(page: Page, pedido: Record<string, unknown>) {
  await page.route(`**/pedidos/meus/${pedido.id}`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({ json: { pedido, itens: [], total: pedido.total } });
  });
}

test.describe("Minha Conta / Pedidos — indicador de envio na listagem", () => {
  test("PAGO + NAO_ENVIADO mostra '📦 Aguardando envio'", async ({ page }) => {
    await seedSession(page);
    await mockListaMeusPedidos(page, [pedidoBase()]);

    await page.goto("/conta/pedidos");

    await expect(page.getByText("📦 Aguardando envio")).toBeVisible();
    await expect(page.getByText("🚚 Enviado")).toHaveCount(0);
  });

  test("PAGO + ENVIADO mostra '🚚 Enviado'", async ({ page }) => {
    await seedSession(page);
    await mockListaMeusPedidos(page, [
      pedidoBase({ statusEnvio: "ENVIADO", enviadoEm: "2026-08-21T14:00:00.000Z" }),
    ]);

    await page.goto("/conta/pedidos");

    await expect(page.getByText("🚚 Enviado")).toBeVisible();
    await expect(page.getByText("📦 Aguardando envio")).toHaveCount(0);
  });

  test("pedidos que não são PAGO não mostram indicador de envio (regressão)", async ({ page }) => {
    await seedSession(page);
    await mockListaMeusPedidos(page, [
      pedidoBase({ id: 11, numero: "PED-11", status: "PENDENTE" }),
      pedidoBase({ id: 12, numero: "PED-12", status: "CANCELADO" }),
    ]);

    await page.goto("/conta/pedidos");

    await expect(page.getByText("📦 Aguardando envio")).toHaveCount(0);
    await expect(page.getByText("🚚 Enviado")).toHaveCount(0);
    // Os pedidos continuam aparecendo normalmente, só sem o indicador.
    await expect(page.getByText("Pedido PED-11")).toBeVisible();
    await expect(page.getByText("Pedido PED-12")).toBeVisible();
  });
});

test.describe("Minha Conta / Pedidos — timeline no detalhe", () => {
  test("PAGO + NAO_ENVIADO: timeline mostra 'Aguardando envio' como etapa atual", async ({ page }) => {
    await seedSession(page);
    const pedido = pedidoBase();
    await mockDetalheMeuPedido(page, pedido);

    await page.goto(`/conta/pedidos/${pedido.id}`);

    await expect(page.getByText("Aguardando envio")).toBeVisible();
    await expect(page.getByText("Pedido enviado")).toHaveCount(0);
    await expect(
      page.getByText("Ainda não temos informações de envio/rastreio disponíveis para este pedido."),
    ).toBeVisible();
  });

  test("PAGO + ENVIADO: timeline mostra 'Pedido enviado' e a data de envio", async ({ page }) => {
    await seedSession(page);
    const pedido = pedidoBase({ statusEnvio: "ENVIADO", enviadoEm: "2026-08-21T14:00:00.000Z" });
    await mockDetalheMeuPedido(page, pedido);

    await page.goto(`/conta/pedidos/${pedido.id}`);

    await expect(page.getByText("Pedido enviado")).toBeVisible();
    await expect(page.getByText("Aguardando envio")).toHaveCount(0);
    // enviadoEm em America/Sao_Paulo (UTC-3): 21/08/2026 14h UTC ainda é
    // 21/08 no Brasil — sem risco do bug de fuso aqui.
    await expect(page.getByText(/Enviado em 21\/08\/2026/)).toBeVisible();
  });

  test("PENDENTE continua funcionando sem menção a envio (regressão)", async ({ page }) => {
    await seedSession(page);
    const pedido = pedidoBase({ status: "PENDENTE" });
    await mockDetalheMeuPedido(page, pedido);

    await page.goto(`/conta/pedidos/${pedido.id}`);

    await expect(page.getByText("Pedido realizado")).toBeVisible();
    await expect(page.getByText("Aguardando envio")).toHaveCount(0);
    await expect(page.getByText("Pedido enviado")).toHaveCount(0);
  });

  test("CANCELADO continua mostrando a timeline de cancelamento, sem etapa de envio (regressão)", async ({
    page,
  }) => {
    await seedSession(page);
    const pedido = pedidoBase({ status: "CANCELADO" });
    await mockDetalheMeuPedido(page, pedido);

    await page.goto(`/conta/pedidos/${pedido.id}`);

    await expect(page.getByText("Cancelado", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Aguardando envio")).toHaveCount(0);
    await expect(page.getByText("Pedido enviado")).toHaveCount(0);
  });
});

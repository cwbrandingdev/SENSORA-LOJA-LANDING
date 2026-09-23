import { test, expect, type Page } from "@playwright/test";

// Vistoria de Alertas Operacionais (Admin) — suíte E2E do AlertasPanel,
// montado em app/workspace-x/page.tsx (Dashboard). Mesmo padrão de mock via
// page.route do resto do projeto: backend real indisponível neste ambiente
// de teste, GET /dashboard/resumo é sempre mockado com um resumo neutro
// (nenhum destes testes verifica o conteúdo dos cards de "Visão geral" —
// isso é e2e/admin-dashboard-dados.spec.ts) só para a página terminar de
// carregar sem cair em erro/401 real.

const DASHBOARD_URL = "/workspace-x";
const TOKEN_KEY = "sensora_token";

function base64Url(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fakeToken(perfil: "ADMIN" | "VENDEDOR" = "ADMIN"): string {
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

const RESUMO_NEUTRO = {
  faturamento: 0,
  pedidos: {
    total: 0,
    pagos: 0,
    porStatus: { PENDENTE: 0, PAGO: 0, CANCELADO: 0, REEMBOLSO_SOLICITADO: 0, REEMBOLSADO: 0 },
  },
  produtos: { total: 0, ativos: 0, semEstoque: 0, estoqueBaixo: 0 },
  categorias: { total: 0 },
  clientes: { total: 0, ativos: 0 },
};

async function mockDashboardResumo(page: Page) {
  await page.route("**/dashboard/resumo", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: RESUMO_NEUTRO });
      return;
    }
    await route.continue();
  });
}

async function mockAlertas(
  page: Page,
  resposta: unknown[] | { status: number; aguardar?: Promise<void> },
) {
  await page.route("**/alertas", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    if (Array.isArray(resposta)) {
      await route.fulfill({ json: resposta });
      return;
    }
    if (resposta.aguardar) await resposta.aguardar;
    await route.fulfill({ status: resposta.status, body: "" });
  });
}

test.describe("Admin — Painel de Alertas (Dashboard)", () => {
  test("sem alertas: mostra o estado vazio, nunca uma lista/erro", async ({ page }) => {
    await seedSession(page);
    await mockDashboardResumo(page);
    await mockAlertas(page, []);

    await page.goto(DASHBOARD_URL);

    await expect(page.getByRole("heading", { name: "Alertas" })).toBeVisible();
    await expect(page.getByText("Nenhum alerta no momento")).toBeVisible();
  });

  test("4 alertas: cada um mostra título/quantidade e linka para a tela certa", async ({
    page,
  }) => {
    await seedSession(page);
    await mockDashboardResumo(page);
    await mockAlertas(page, [
      {
        tipo: "ESTOQUE_BAIXO",
        severidade: "danger",
        titulo: "Produtos com estoque baixo ou esgotado",
        quantidade: 3,
        link: "/workspace-x/produtos",
      },
      {
        tipo: "REEMBOLSO_SOLICITADO",
        severidade: "danger",
        titulo: "Reembolsos solicitados aguardando confirmação",
        quantidade: 2,
        link: "/workspace-x/pedidos",
      },
      {
        tipo: "PEDIDO_AGUARDANDO_ENVIO",
        severidade: "warning",
        titulo: "Pedidos pagos há mais de 3 dias aguardando envio",
        quantidade: 5,
        link: "/workspace-x/pedidos",
      },
      {
        tipo: "MELHOR_ENVIO_DESCONECTADO",
        severidade: "danger",
        titulo: "Melhor Envio desconectado — cotação de frete indisponível",
        quantidade: 1,
        link: "/workspace-x/integracoes",
      },
    ]);

    await page.goto(DASHBOARD_URL);

    await expect(page.getByText("Produtos com estoque baixo ou esgotado")).toBeVisible();
    await expect(page.getByText("Reembolsos solicitados aguardando confirmação")).toBeVisible();
    await expect(page.getByText("Pedidos pagos há mais de 3 dias aguardando envio")).toBeVisible();
    await expect(
      page.getByText("Melhor Envio desconectado — cotação de frete indisponível"),
    ).toBeVisible();

    // Cada item é um link para a rota BASE certa (nunca query string — a
    // página de destino não interpreta parâmetro nenhum, ver vistoria).
    await expect(
      page.getByRole("link", { name: /Produtos com estoque baixo ou esgotado/ }),
    ).toHaveAttribute("href", "/workspace-x/produtos");
    await expect(
      page.getByRole("link", { name: /Reembolsos solicitados/ }),
    ).toHaveAttribute("href", "/workspace-x/pedidos");
    await expect(
      page.getByRole("link", { name: /Melhor Envio desconectado/ }),
    ).toHaveAttribute("href", "/workspace-x/integracoes");

    // Nunca o estado vazio junto com alertas reais.
    await expect(page.getByText("Nenhum alerta no momento")).toHaveCount(0);
  });

  test("clicar num alerta navega para a tela que resolve o problema", async ({ page }) => {
    await seedSession(page);
    await mockDashboardResumo(page);
    await mockAlertas(page, [
      {
        tipo: "MELHOR_ENVIO_DESCONECTADO",
        severidade: "danger",
        titulo: "Melhor Envio desconectado — cotação de frete indisponível",
        quantidade: 1,
        link: "/workspace-x/integracoes",
      },
    ]);
    // A tela de destino também faz chamadas próprias — mockadas só o
    // suficiente para não quebrar a navegação (o conteúdo dela já é
    // coberto por e2e/admin-integracoes.spec.ts).
    await page.route("**/admin/asaas/status", (route) =>
      route.fulfill({ json: { configured: false, gatewayAtivo: "asaas" } }),
    );
    await page.route("**/admin/mail/status", (route) =>
      route.fulfill({ json: { configured: false } }),
    );
    await page.route("**/imagekit/status", (route) =>
      route.fulfill({ json: { configured: false } }),
    );
    await page.route("**/admin/melhor-envio/status", (route) =>
      route.fulfill({
        json: { configured: false, conectado: false, ambiente: "sandbox", expiresAt: null },
      }),
    );

    await page.goto(DASHBOARD_URL);
    await page.getByRole("link", { name: /Melhor Envio desconectado/ }).click();

    await expect(page).toHaveURL("/workspace-x/integracoes");
  });

  test("loading: mostra skeleton enquanto GET /alertas está em voo", async ({ page }) => {
    await seedSession(page);
    await mockDashboardResumo(page);

    let liberar!: () => void;
    const aguardar = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    await page.route("**/alertas", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await aguardar;
      await route.fulfill({ json: [] });
    });

    await page.goto(DASHBOARD_URL);

    // Skeleton.tsx: raiz aria-hidden + relative overflow-hidden — 2 no
    // AlertasPanel, nenhum título de alerta nem estado vazio ainda.
    await expect(page.locator('[aria-hidden="true"].relative.overflow-hidden')).toHaveCount(2);
    await expect(page.getByText("Nenhum alerta no momento")).toHaveCount(0);

    liberar();

    await expect(page.getByText("Nenhum alerta no momento")).toBeVisible();
  });

  test("erro ao carregar alertas: mostra mensagem com Tentar novamente, sem quebrar a página", async ({
    page,
  }) => {
    await seedSession(page);
    await mockDashboardResumo(page);
    await mockAlertas(page, { status: 500 });

    await page.goto(DASHBOARD_URL);

    await expect(page.getByText("Não foi possível carregar os alertas.")).toBeVisible();
    const retry = page.getByRole("button", { name: "Tentar novamente" });
    await expect(retry).toBeVisible();

    await page.unroute("**/alertas");
    await mockAlertas(page, []);
    await retry.click();

    await expect(page.getByText("Nenhum alerta no momento")).toBeVisible();
  });

  test("VENDEDOR: GET /alertas é ADMIN-only (403) — painel mostra erro, resto do Dashboard funciona", async ({
    page,
  }) => {
    await seedSession(page, "VENDEDOR");
    await mockDashboardResumo(page);
    await mockAlertas(page, { status: 403 });

    await page.goto(DASHBOARD_URL);

    await expect(page.getByRole("heading", { name: "Dashboard Sensora" })).toBeVisible();
    await expect(page.getByText("Não foi possível carregar os alertas.")).toBeVisible();
  });
});

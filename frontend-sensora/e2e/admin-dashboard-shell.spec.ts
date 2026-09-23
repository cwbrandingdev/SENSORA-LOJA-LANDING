import { test, expect, type Page } from "@playwright/test";

// Etapa 6.6 (Dashboard Admin) — suíte E2E do shell administrativo (Header +
// Sidebar responsiva + ProtectedLayout), criada no Lote 1. Cobre Header
// mostrando o usuário real e a Sidebar virando gaveta em mobile (sem
// regressão do comportamento desktop). Mesmo padrão de mock via page.route
// do resto do projeto.
//
// Manutenção (vistoria de Alertas Operacionais) — o Dashboard não chama
// mais GET /pedidos, /produtos e /categorias: um ÚNICO GET /dashboard/resumo
// (já agregado no banco) alimenta os 6 cards, e a página também monta o
// AlertasPanel (GET /alertas). `mockDashboardApiVazio` abaixo mocka essas
// duas rotas: sem isso, essas chamadas cairiam no backend real (token fake,
// 401) e o interceptor de services/api.ts derrubaria a sessão no meio do
// teste — quebrando os testes de Header/Sidebar desta suíte, que não têm
// nada a ver com o conteúdo dos cards nem dos alertas. Os testes de
// comportamento dos cards com dados reais (valor calculado, loading, erro,
// estado vazio) ficam em e2e/admin-dashboard-dados.spec.ts, e os do
// AlertasPanel em e2e/admin-alertas.spec.ts — aqui só resta uma checagem
// leve de que a seção "Visão geral" e os 4 títulos existem.
//
// Achado da manutenção: as rotas eram mockadas com um prefixo absoluto
// `http://localhost:3000`, que nunca correspondeu ao backend real
// configurado neste ambiente (NEXT_PUBLIC_API_URL aponta para
// https://backend-sensora-bright.fly.dev, ver .env/.env.local) — os mocks
// nunca interceptavam nada, e vários testes desta suíte vinham batendo em
// rede real. Trocado por padrão glob (`**/...`), mesmo usado em
// e2e/admin-integracoes.spec.ts e e2e/admin-alertas.spec.ts, que não
// depende do host configurado.

const TOKEN_KEY = "sensora_token";
const DASHBOARD_URL = "/workspace-x";
const PRODUTOS_URL = "/workspace-x/produtos";

function base64Url(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fakeToken(perfil: "ADMIN" | "VENDEDOR", email: string): string {
  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const payload = base64Url({
    sub: 1,
    email,
    perfil,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.assinatura-fake`;
}

async function seedSession(page: Page, perfil: "ADMIN" | "VENDEDOR" = "ADMIN", email = "admin@sensora.dev") {
  await page.addInitScript(
    ([tokenKey, token]) => {
      window.localStorage.setItem(tokenKey, token);
    },
    [TOKEN_KEY, fakeToken(perfil, email)] as const,
  );
}

async function mockListasVazias(page: Page) {
  await page.route("**/dashboard/resumo", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      json: {
        faturamento: 0,
        pedidos: {
          total: 0,
          pagos: 0,
          porStatus: {
            PENDENTE: 0,
            PAGO: 0,
            CANCELADO: 0,
            REEMBOLSO_SOLICITADO: 0,
            REEMBOLSADO: 0,
          },
        },
        produtos: { total: 0, ativos: 0, semEstoque: 0, estoqueBaixo: 0 },
        categorias: { total: 0 },
        clientes: { total: 0, ativos: 0 },
      },
    });
  });
  await page.route("**/alertas", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: [] });
      return;
    }
    await route.continue();
  });
}

test.describe("Dashboard Admin — Header", () => {
  test("mostra o e-mail e o perfil reais do usuário logado, sem novo endpoint", async ({ page }) => {
    await seedSession(page, "ADMIN", "gestora@sensora.dev");
    await mockListasVazias(page);

    await page.goto(DASHBOARD_URL);

    await expect(page.getByText("gestora@sensora.dev")).toBeVisible();
    await expect(page.getByText("Administrador")).toBeVisible();
  });

  test("VENDEDOR vê o próprio e-mail e o rótulo 'Vendedor'", async ({ page }) => {
    await seedSession(page, "VENDEDOR", "vendedor@sensora.dev");
    await mockListasVazias(page);

    await page.goto(DASHBOARD_URL);

    await expect(page.getByText("vendedor@sensora.dev")).toBeVisible();
    await expect(page.getByText("Vendedor", { exact: true })).toBeVisible();
  });
});

test.describe("Dashboard Admin — Sidebar responsiva", () => {
  test("desktop: sidebar sempre visível, sem botão de menu", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await seedSession(page);
    await mockListasVazias(page);

    await page.goto(DASHBOARD_URL);

    await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).toBeInViewport();
    await expect(page.getByRole("button", { name: "Abrir menu de navegação" })).toBeHidden();
  });

  test("mobile: sidebar começa fechada (fora da viewport) e o botão de menu aparece", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await seedSession(page);
    await mockListasVazias(page);

    await page.goto(DASHBOARD_URL);

    await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).not.toBeInViewport();
    await expect(page.getByRole("button", { name: "Abrir menu de navegação" })).toBeVisible();
  });

  test("mobile: abrir o menu traz a sidebar para a viewport com overlay", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await seedSession(page);
    await mockListasVazias(page);

    await page.goto(DASHBOARD_URL);
    await page.getByRole("button", { name: "Abrir menu de navegação" }).click();

    await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).toBeInViewport();
    await expect(page.getByRole("link", { name: "Produtos" })).toBeVisible();
  });

  test("mobile: clicar no overlay fecha o menu", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await seedSession(page);
    await mockListasVazias(page);

    await page.goto(DASHBOARD_URL);
    await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
    await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).toBeInViewport();

    // Overlay é o único elemento com esse aria-hidden — clica fora da nav
    // (a nav tem w-64 = 256px a partir da esquerda; x=350 cai na faixa do
    // overlay ainda visível numa viewport de 375px).
    await page.locator('[aria-hidden="true"].fixed.inset-0').click({ position: { x: 350, y: 5 } });

    await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).not.toBeInViewport();
  });

  test("mobile: Escape fecha o menu", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await seedSession(page);
    await mockListasVazias(page);

    await page.goto(DASHBOARD_URL);
    await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
    await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).toBeInViewport();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).not.toBeInViewport();
  });

  test("mobile: navegar para outra rota fecha o menu automaticamente", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await seedSession(page);
    await mockListasVazias(page);

    await page.goto(DASHBOARD_URL);
    await page.getByRole("button", { name: "Abrir menu de navegação" }).click();
    await page.getByRole("link", { name: "Produtos" }).click();

    await expect(page).toHaveURL(PRODUTOS_URL);
    await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).not.toBeInViewport();
  });

  test("rotas e visibilidade por perfil são preservadas (VENDEDOR não vê Usuários/Integrações)", async ({
    page,
  }) => {
    await seedSession(page, "VENDEDOR");
    await mockListasVazias(page);

    await page.goto(DASHBOARD_URL);

    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Produtos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Categorias" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Clientes" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pedidos" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Usuários" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Integrações" })).toHaveCount(0);
  });
});

test.describe("Dashboard Admin — cards de Visão geral (estrutura)", () => {
  test("a seção 'Visão geral' e os 4 títulos de card existem", async ({ page }) => {
    await seedSession(page);
    await mockListasVazias(page);

    await page.goto(DASHBOARD_URL);

    await expect(page.getByRole("heading", { name: "Visão geral" })).toBeVisible();
    await expect(page.getByText("Faturamento")).toBeVisible();
    await expect(page.getByText("Pedidos", { exact: true })).toHaveCount(2); // card + link da sidebar
    await expect(page.getByText("Produtos", { exact: true })).toHaveCount(2);
    await expect(page.getByText("Categorias", { exact: true })).toHaveCount(2);
  });
});

// Etapa 8.12 (ocultação da rota administrativa /admin → /workspace-x) —
// prova que a rota antiga não serve mais nenhuma página administrativa: o
// diretório app/admin/** foi movido (não duplicado) para
// app/workspace-x/**, então o Next.js não tem mais nenhum handler
// registrado para "/admin" nem para nenhuma subrota dela — deve cair na
// página padrão de not-found (404), com ADMIN autenticado ou não (a
// ausência de rota é resolvida antes de qualquer guard rodar).
test.describe("Dashboard Admin — rota antiga /admin não existe mais", () => {
  test("/admin não serve mais o painel administrativo (404), mesmo para ADMIN autenticado", async ({
    page,
  }) => {
    await seedSession(page, "ADMIN");

    const response = await page.goto("/admin");

    expect(response?.status()).toBe(404);
    await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Navegação administrativa" })).toHaveCount(
      0,
    );
  });

  test("subrotas antigas (/admin/produtos, /admin/pedidos) também não existem mais", async ({
    page,
  }) => {
    await seedSession(page, "ADMIN");

    const respostaProdutos = await page.goto("/admin/produtos");
    expect(respostaProdutos?.status()).toBe(404);

    const respostaPedidos = await page.goto("/admin/pedidos");
    expect(respostaPedidos?.status()).toBe(404);
  });
});

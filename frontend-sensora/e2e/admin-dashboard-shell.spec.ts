import { test, expect, type Page } from "@playwright/test";

// Etapa 6.6 (Dashboard Admin) — suíte E2E do shell administrativo (Header +
// Sidebar responsiva + ProtectedLayout), criada no Lote 1. Cobre Header
// mostrando o usuário real e a Sidebar virando gaveta em mobile (sem
// regressão do comportamento desktop). Mesmo padrão de mock via page.route
// do resto do projeto.
//
// Lote 2 — o Dashboard passou a chamar GET /pedidos além de /produtos e
// /categorias (ver app/admin/page.tsx), então `mockListasVazias` abaixo
// precisou passar a mockar /pedidos também: sem isso, essas chamadas cairiam
// no backend real (token fake, 401) e o interceptor de services/api.ts
// derrubaria a sessão no meio do teste — quebrando os testes de Header/
// Sidebar desta suíte, que não têm nada a ver com o conteúdo dos cards. Os
// testes de comportamento dos cards com dados reais (valor calculado,
// loading, erro parcial, estado vazio) ficam em
// e2e/admin-dashboard-dados.spec.ts — aqui só resta uma checagem leve de
// que a seção "Visão geral" e os 4 títulos existem.

const TOKEN_KEY = "sensora_token";
const DASHBOARD_URL = "/admin";
const PRODUTOS_URL = "/admin/produtos";
const API_URL = "http://localhost:3000";

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
  for (const rota of ["pedidos", "produtos", "categorias", "clientes"]) {
    await page.route(`${API_URL}/${rota}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: [] });
        return;
      }
      await route.continue();
    });
  }
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

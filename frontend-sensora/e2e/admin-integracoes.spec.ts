import { test, expect, type Page } from "@playwright/test";

// Central de Integrações (Admin) — suíte E2E de /workspace-x/integracoes
// (Etapa 8.12, antes /admin/integracoes): guarda
// ADMIN-only (página + item da sidebar), os 4 cards (Asaas/Melhor Envio/
// Resend/ImageKit) e que nenhum deles expõe segredo. O comportamento
// específico de cada card de status (loading/erro/retry) já é coberto por
// e2e/admin-melhor-envio.spec.ts (Melhor Envio, com fluxo OAuth próprio) —
// aqui o foco é a página como um todo. Mesmo padrão de mock via page.route
// do resto do projeto (backend real indisponível neste ambiente).

const INTEGRACOES_URL = "/workspace-x/integracoes";
const DASHBOARD_URL = "/workspace-x";
const TOKEN_KEY = "sensora_token";

function base64Url(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fakeToken(perfil: "ADMIN" | "VENDEDOR" | "CLIENTE", sub = 41): string {
  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const payload = base64Url({
    sub,
    email: "staff@sensora.dev",
    perfil,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.assinatura-fake`;
}

async function seedSession(page: Page, perfil: "ADMIN" | "VENDEDOR" | "CLIENTE") {
  await page.addInitScript(
    ([tokenKey, token]) => {
      window.localStorage.setItem(tokenKey, token);
    },
    [TOKEN_KEY, fakeToken(perfil)] as const,
  );
}

// Etapa 6.6 (Dashboard Admin, Lote 2) — /workspace-x (Etapa 8.12, antes
// /admin) passou a chamar GET /pedidos, /produtos e /categorias (ver
// app/workspace-x/page.tsx). Sem mockar
// essas três rotas, os testes abaixo que navegam para DASHBOARD_URL cairiam
// no backend real (token fake → 401), disparando o redirect automático do
// interceptor de services/api.ts NO MEIO do teste — não tem relação com o
// que esta suíte testa (guarda ADMIN-only de Integrações), por isso só
// neutralizamos com listas vazias, sem validar o conteúdo dos cards aqui
// (isso é coberto em e2e/admin-dashboard-dados.spec.ts).
async function mockDashboardApisVazias(page: Page) {
  for (const rota of ["pedidos", "produtos", "categorias"]) {
    await page.route(`**/${rota}`, async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ json: [] });
        return;
      }
      await route.continue();
    });
  }
}

async function mockTodosOsStatus(
  page: Page,
  opts?: {
    asaas?: { configured: boolean; baseUrl?: string };
    melhorEnvio?: boolean;
    resend?: boolean;
    imagekit?: boolean;
  },
) {
  await page.route("**/admin/asaas/status", async (route) => {
    await route.fulfill({
      json: opts?.asaas ?? { configured: true, baseUrl: "https://api.asaas.com/v3" },
    });
  });
  await page.route("**/admin/melhor-envio/status", async (route) => {
    await route.fulfill({ json: { conectado: opts?.melhorEnvio ?? true } });
  });
  await page.route("**/admin/mail/status", async (route) => {
    await route.fulfill({ json: { configured: opts?.resend ?? true } });
  });
  await page.route("**/imagekit/status", async (route) => {
    await route.fulfill({ json: { configured: opts?.imagekit ?? true } });
  });
}

test.describe("Admin — Central de Integrações: acesso ADMIN-only", () => {
  test("ADMIN acessa /workspace-x/integracoes normalmente", async ({ page }) => {
    await seedSession(page, "ADMIN");
    await mockTodosOsStatus(page);

    await page.goto(INTEGRACOES_URL);

    await expect(page).toHaveURL(INTEGRACOES_URL);
    await expect(page.getByRole("heading", { name: "Integrações" })).toBeVisible();
  });

  test("VENDEDOR é redirecionado para o Dashboard ao tentar acessar /workspace-x/integracoes diretamente", async ({
    page,
  }) => {
    await mockDashboardApisVazias(page);
    await seedSession(page, "VENDEDOR");
    const chamadasDeStatus: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (
        url.includes("/admin/asaas/status") ||
        url.includes("/admin/mail/status") ||
        url.includes("/imagekit/status") ||
        url.includes("/admin/melhor-envio/status")
      ) {
        chamadasDeStatus.push(url);
      }
    });

    await page.goto(INTEGRACOES_URL);

    await expect(page).toHaveURL(DASHBOARD_URL);
    await expect(page.getByText("Integrações")).toHaveCount(0);
    // Nem chega a chamar os endpoints de status — o guard de página barra
    // antes de qualquer card montar.
    expect(chamadasDeStatus).toEqual([]);
  });

  test("CLIENTE é redirecionado para /loja (ProtectedLayout, igual às demais rotas do admin)", async ({
    page,
  }) => {
    await seedSession(page, "CLIENTE");

    await page.goto(INTEGRACOES_URL);

    await expect(page).toHaveURL("/loja");
  });

  test("VENDEDOR não vê o item 'Integrações' na sidebar; ADMIN vê", async ({ page }) => {
    await mockDashboardApisVazias(page);
    await seedSession(page, "VENDEDOR");
    await page.goto(DASHBOARD_URL);
    await expect(page.getByRole("link", { name: "Integrações" })).toHaveCount(0);

    await seedSession(page, "ADMIN");
    await page.goto(DASHBOARD_URL);
    await expect(page.getByRole("link", { name: "Integrações" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Integrações" })).toHaveAttribute(
      "href",
      INTEGRACOES_URL,
    );
  });
});

test.describe("Admin — Central de Integrações: os 4 cards", () => {
  test("carrega os cards de Asaas, Melhor Envio, Resend e ImageKit, todos configurados", async ({
    page,
  }) => {
    await seedSession(page, "ADMIN");
    await mockTodosOsStatus(page, {
      asaas: { configured: true, baseUrl: "https://api.asaas.com/v3" },
      melhorEnvio: true,
      resend: true,
      imagekit: true,
    });

    await page.goto(INTEGRACOES_URL);

    await expect(page.getByRole("heading", { name: "Asaas" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Melhor Envio" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Resend" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "ImageKit" })).toBeVisible();

    // 4 cards, todos "Configurado"/"Conectado" — nenhum preso em
    // "Verificando..."/erro.
    await expect(page.getByText("Configurado", { exact: true })).toHaveCount(3);
    await expect(page.getByText("Conectado", { exact: true })).toHaveCount(1);
  });

  test("cada card reflete 'não configurado' independentemente dos outros", async ({ page }) => {
    await seedSession(page, "ADMIN");
    await mockTodosOsStatus(page, {
      asaas: { configured: false },
      melhorEnvio: false,
      resend: false,
      imagekit: true,
    });

    await page.goto(INTEGRACOES_URL);

    await expect(page.getByText("Não configurado", { exact: true })).toHaveCount(2);
    await expect(page.getByText("Não conectado", { exact: true })).toBeVisible();
    await expect(page.getByText("Configurado", { exact: true })).toHaveCount(1);
  });

  test("Asaas: exibe a base URL devolvida pelo backend quando configurado, nada além disso", async ({
    page,
  }) => {
    await seedSession(page, "ADMIN");
    await mockTodosOsStatus(page, {
      asaas: { configured: true, baseUrl: "https://sandbox.asaas.com/api/v3" },
    });

    await page.goto(INTEGRACOES_URL);

    await expect(page.getByText("https://sandbox.asaas.com/api/v3")).toBeVisible();
  });

  test("nenhum card expõe segredo (API key, token, secret, senha) em nenhum lugar da página", async ({
    page,
  }) => {
    await seedSession(page, "ADMIN");
    await mockTodosOsStatus(page);

    await page.goto(INTEGRACOES_URL);
    await expect(page.getByRole("heading", { name: "ImageKit" })).toBeVisible();

    // Só nomes técnicos de credencial (nunca palavras comuns como "senha" —
    // "recuperação de senha" é texto legítimo da descrição do card Resend,
    // não um vazamento).
    const conteudo = await page.content();
    const textoMinusculo = conteudo.toLowerCase();
    for (const termoProibido of [
      "api_key",
      "apikey",
      "secret",
      "access_token",
      "accesstoken",
      "refresh_token",
      "refreshtoken",
      "webhook_token",
      "private_key",
      "privatekey",
    ]) {
      expect(textoMinusculo).not.toContain(termoProibido);
    }
  });

  test("erro ao verificar um card (Resend) não derruba os demais", async ({ page }) => {
    await seedSession(page, "ADMIN");
    await mockTodosOsStatus(page, { asaas: { configured: true }, melhorEnvio: true, imagekit: true });
    await page.route("**/admin/mail/status", async (route) => {
      await route.fulfill({ status: 500, body: "" });
    });

    await page.goto(INTEGRACOES_URL);

    await expect(page.getByRole("heading", { name: "Resend" })).toBeVisible();
    await expect(page.getByText("Erro ao verificar")).toBeVisible();
    // Os outros 3 continuam normais.
    await expect(page.getByText("Configurado", { exact: true })).toHaveCount(2);
    await expect(page.getByText("Conectado", { exact: true })).toBeVisible();
  });
});

test.describe("Admin — Central de Integrações: Dashboard", () => {
  test("Dashboard não exibe mais o card/seção do Melhor Envio", async ({ page }) => {
    await mockDashboardApisVazias(page);
    await seedSession(page, "ADMIN");
    await page.goto(DASHBOARD_URL);

    await expect(page.getByText("Dashboard Sensora")).toBeVisible();
    await expect(page.getByText("Melhor Envio")).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Integrações" })).toHaveCount(0);
  });
});

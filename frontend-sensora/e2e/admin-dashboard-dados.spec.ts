import { test, expect, type Page, type Locator } from "@playwright/test";

// Etapa 6.6 (Dashboard Admin, Lote 2) — suíte E2E dedicada aos dados reais
// dos 4 cards de "Visão geral" (Faturamento/Pedidos/Produtos/Categorias),
// conectados neste lote a GET /pedidos, /produtos e /categorias (as únicas
// APIs autorizadas — nenhum endpoint novo). Cobre: cálculo correto de cada
// métrica, loading (skeleton) enquanto as chamadas estão em voo, erro
// independente por card (uma API falhando não apaga as demais) e estado
// vazio (distinto de erro). Mesmo padrão de mock via page.route do resto
// do projeto.

const TOKEN_KEY = "sensora_token";
const DASHBOARD_URL = "/admin";
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

// MetricCard.tsx: raiz `rounded-lg border ...` — única combinação de
// classes que identifica um card de métrica (a Sidebar/links usam
// rounded-md, sem border), então basta escopar por essas duas classes.
function card(page: Page, titulo: string): Locator {
  return page.locator(".rounded-lg.border").filter({ hasText: titulo });
}

const PEDIDOS = [
  { id: 1, numero: "PED-1", data: "2026-08-01T00:00:00.000Z", status: "PAGO", total: 100.5 },
  { id: 2, numero: "PED-2", data: "2026-08-02T00:00:00.000Z", status: "PAGO", total: 50.25 },
  { id: 3, numero: "PED-3", data: "2026-08-03T00:00:00.000Z", status: "PENDENTE", total: 30 },
  { id: 4, numero: "PED-4", data: "2026-08-04T00:00:00.000Z", status: "CANCELADO", total: 75 },
];

const PRODUTOS = [
  { id: 1, nome: "Vela A", slug: "vela-a", preco: 59.9, quantidade: 10, ativo: true, destaque: false },
  { id: 2, nome: "Vela B", slug: "vela-b", preco: 39.9, quantidade: 5, ativo: true, destaque: false },
  { id: 3, nome: "Vela C (inativa)", slug: "vela-c", preco: 19.9, quantidade: 0, ativo: false, destaque: false },
];

const CATEGORIAS = [
  { id: 1, nome: "Velas", slug: "velas" },
  { id: 2, nome: "Sprays", slug: "sprays" },
];

type RotaOverride = { status: number; body?: unknown; aguardar?: Promise<void> };
type MockOpts = { pedidos?: RotaOverride; produtos?: RotaOverride; categorias?: RotaOverride };

async function mockDashboardApis(page: Page, opts: MockOpts = {}) {
  const rotas: Array<["pedidos" | "produtos" | "categorias", unknown]> = [
    ["pedidos", PEDIDOS],
    ["produtos", PRODUTOS],
    ["categorias", CATEGORIAS],
  ];

  for (const [rota, dadosPadrao] of rotas) {
    const override = opts[rota];
    await page.route(`${API_URL}/${rota}`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      if (!override) {
        await route.fulfill({ json: dadosPadrao });
        return;
      }
      if (override.aguardar) {
        await override.aguardar;
      }
      await route.fulfill({ status: override.status, json: override.body ?? dadosPadrao });
    });
  }
}

test.describe("Dashboard Admin — dados reais dos cards", () => {
  test("Faturamento soma só os pedidos PAGO, formatado em R$ pt-BR", async ({ page }) => {
    await seedSession(page);
    await mockDashboardApis(page);

    await page.goto(DASHBOARD_URL);

    // 100.50 + 50.25 = 150.75 — PENDENTE/CANCELADO ficam de fora.
    const cardFaturamento = card(page, "Faturamento");
    await expect(cardFaturamento.getByText("R$ 150,75")).toBeVisible();
    await expect(cardFaturamento.getByText("2 pedidos pagos")).toBeVisible();
  });

  test("Pedidos mostra o total e a distribuição por status", async ({ page }) => {
    await seedSession(page);
    await mockDashboardApis(page);

    await page.goto(DASHBOARD_URL);

    const cardPedidos = card(page, "Pedidos");
    await expect(cardPedidos.getByText("4", { exact: true })).toBeVisible();
    await expect(cardPedidos.getByText("1 pendentes · 2 pagos · 1 cancelados")).toBeVisible();
  });

  test("Produtos mostra o total e quantos estão ativos", async ({ page }) => {
    await seedSession(page);
    await mockDashboardApis(page);

    await page.goto(DASHBOARD_URL);

    const cardProdutos = card(page, "Produtos");
    await expect(cardProdutos.getByText("3", { exact: true })).toBeVisible();
    await expect(cardProdutos.getByText("2 ativos")).toBeVisible();
  });

  test("Categorias mostra o total retornado por GET /categorias, sem métrica inventada", async ({ page }) => {
    await seedSession(page);
    await mockDashboardApis(page);

    await page.goto(DASHBOARD_URL);

    const cardCategorias = card(page, "Categorias");
    await expect(cardCategorias.getByText("2", { exact: true })).toBeVisible();
  });

  test("loading: mostra skeleton enquanto as chamadas estão em andamento", async ({ page }) => {
    await seedSession(page);

    // Segura as 3 respostas atrás de uma Promise controlada manualmente em
    // vez de um delay fixo: evita corrida entre o timing do teste e o
    // tempo real da requisição (um `delayMs` fixo poderia já ter decorrido
    // antes da asserção "ainda em loading" rodar, tornando o teste flaky).
    let liberarRespostas!: () => void;
    const respostasLiberadas = new Promise<void>((resolve) => {
      liberarRespostas = resolve;
    });
    await mockDashboardApis(page, {
      pedidos: { status: 200, aguardar: respostasLiberadas },
      produtos: { status: 200, aguardar: respostasLiberadas },
      categorias: { status: 200, aguardar: respostasLiberadas },
    });

    await page.goto(DASHBOARD_URL);

    // Skeleton.tsx: raiz aria-hidden + relative overflow-hidden — um por
    // card, nenhum valor numérico ainda visível antes da resposta chegar.
    await expect(page.locator('[aria-hidden="true"].relative.overflow-hidden')).toHaveCount(4);
    await expect(page.getByText("R$ 150,75")).toHaveCount(0);

    liberarRespostas();

    await expect(page.getByText("R$ 150,75")).toBeVisible();
    await expect(page.locator('[aria-hidden="true"].relative.overflow-hidden')).toHaveCount(0);
  });

  test("erro em uma API não impede as outras de carregar (Produtos falha, resto funciona)", async ({
    page,
  }) => {
    await seedSession(page);
    await mockDashboardApis(page, {
      produtos: { status: 500, body: { message: "detalhe técnico do backend" } },
    });

    await page.goto(DASHBOARD_URL);

    // Faturamento/Pedidos/Categorias continuam mostrando dado real.
    await expect(card(page, "Faturamento").getByText("R$ 150,75")).toBeVisible();
    await expect(card(page, "Categorias").getByText("2", { exact: true })).toBeVisible();

    // Produtos mostra erro — nunca "0" como se fosse dado real, nunca a
    // mensagem técnica do backend (500 sempre cai no fallback genérico, ver
    // lib/errors.ts).
    const cardProdutos = card(page, "Produtos");
    await expect(cardProdutos.getByText("Não foi possível carregar.")).toBeVisible();
    await expect(cardProdutos.getByText("0", { exact: true })).toHaveCount(0);
    await expect(page.getByText("detalhe técnico do backend")).toHaveCount(0);
  });

  test("lista vazia é um estado diferente de erro (0 real, não falha)", async ({ page }) => {
    await seedSession(page);
    await mockDashboardApis(page, {
      pedidos: { status: 200, body: [] },
      produtos: { status: 200, body: [] },
      categorias: { status: 200, body: [] },
    });

    await page.goto(DASHBOARD_URL);

    await expect(card(page, "Faturamento").getByText("R$ 0,00")).toBeVisible();
    await expect(card(page, "Pedidos").getByText("Nenhum pedido registrado")).toBeVisible();
    await expect(card(page, "Produtos").getByText("Nenhum produto cadastrado")).toBeVisible();
    await expect(card(page, "Categorias").getByText("Nenhuma categoria cadastrada")).toBeVisible();
  });

  test("VENDEDOR também vê os cards com dados reais (Dashboard não é ADMIN-only)", async ({ page }) => {
    await seedSession(page, "VENDEDOR", "vendedor@sensora.dev");
    await mockDashboardApis(page);

    await page.goto(DASHBOARD_URL);

    await expect(card(page, "Faturamento").getByText("R$ 150,75")).toBeVisible();
  });
});

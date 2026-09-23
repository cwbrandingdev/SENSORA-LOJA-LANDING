import { test, expect, type Page, type Locator } from "@playwright/test";

// Etapa 6.6 (Dashboard Admin, Lote 2) — suíte E2E dedicada aos dados reais
// dos 6 cards do Dashboard (Faturamento/Pedidos/Produtos/Categorias/Estoque
// baixo/Clientes).
//
// Manutenção (vistoria de Alertas Operacionais) — o Dashboard não chama
// mais GET /pedidos, /produtos e /categorias: desde a etapa do Dashboard
// operacional agregado, um ÚNICO GET /dashboard/resumo (já agregado no
// banco) alimenta todos os cards, e a página também monta o AlertasPanel
// (GET /alertas, suíte própria em e2e/admin-alertas.spec.ts — aqui ele é só
// neutralizado com uma lista vazia para não interferir). Os mocks abaixo
// foram atualizados para esse contrato; duas consequências diretas na
// arquitetura antiga não existem mais e os testes que dependiam delas foram
// adaptados (não removidos): (1) não há mais "erro independente por card"
// (endpoint único — se ele falhar, os 6 cards falham juntos); (2)
// GET /dashboard/resumo é ADMIN-only (decisão da etapa de Alertas), então
// VENDEDOR deixou de ver dado real nos cards.
//
// Achado da manutenção: as rotas eram mockadas com um prefixo absoluto
// `http://localhost:3000`, que nunca correspondeu ao backend real
// configurado neste ambiente (NEXT_PUBLIC_API_URL aponta para
// https://backend-sensora-bright.fly.dev, ver .env/.env.local) — os mocks
// nunca interceptavam nada, e os testes vinham batendo em rede real (401 →
// redirect para /login no meio do teste). Trocado por padrão glob (`**/...`),
// mesmo usado em e2e/admin-integracoes.spec.ts e e2e/admin-alertas.spec.ts,
// que não depende do host configurado.

const TOKEN_KEY = "sensora_token";
const DASHBOARD_URL = "/workspace-x";

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

// MetricCard.tsx: raiz `rounded-xl ... shadow-md` (revisão visual do card de
// destaque trocou `rounded-lg`/`border` incondicionais por `rounded-xl` +
// `shadow-md` sempre presentes, com `border` só nos cards não-destaque) —
// `.rounded-xl.shadow-md` é a combinação que identifica o card tanto no
// destaque (Faturamento) quanto nos demais, sem colidir com o ícone interno
// (rounded-xl, mas sem shadow-md) nem com os itens do AlertasPanel
// (rounded-lg + shadow-sm).
function card(page: Page, titulo: string): Locator {
  return page.locator(".rounded-xl.shadow-md").filter({ hasText: titulo });
}

// Equivalente agregado do antigo PEDIDOS/PRODUTOS/CATEGORIAS (mesmos
// números, agora no shape de GET /dashboard/resumo — ver
// backend/src/dashboard/entities/dashboard-resumo.entity.ts): 2 pedidos
// PAGO (100.50 + 50.25 = 150.75), 1 PENDENTE, 1 CANCELADO; 3 produtos, 2
// ativos; 2 categorias. `estoqueBaixo`/`semEstoque`/`clientes` não são
// verificados por nenhum teste desta suíte (sempre existiram desde a
// introdução desses 2 cards) — ficam zerados só para um payload válido.
const RESUMO_PADRAO = {
  faturamento: 150.75,
  pedidos: {
    total: 4,
    pagos: 2,
    porStatus: { PENDENTE: 1, PAGO: 2, CANCELADO: 1, REEMBOLSO_SOLICITADO: 0, REEMBOLSADO: 0 },
  },
  produtos: { total: 3, ativos: 2, semEstoque: 0, estoqueBaixo: 0 },
  categorias: { total: 2 },
  clientes: { total: 0, ativos: 0 },
};

const RESUMO_VAZIO = {
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

type RotaOverride = { status: number; body?: unknown; aguardar?: Promise<void> };

async function mockDashboardApis(page: Page, resumoOverride?: RotaOverride) {
  await page.route("**/dashboard/resumo", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    if (!resumoOverride) {
      await route.fulfill({ json: RESUMO_PADRAO });
      return;
    }
    if (resumoOverride.aguardar) {
      await resumoOverride.aguardar;
    }
    await route.fulfill({
      status: resumoOverride.status,
      json: resumoOverride.body ?? RESUMO_PADRAO,
    });
  });

  // AlertasPanel fica fora do escopo desta suíte (ver
  // e2e/admin-alertas.spec.ts) — sempre neutralizado com lista vazia, nunca
  // varia entre os testes abaixo.
  await page.route("**/alertas", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: [] });
      return;
    }
    await route.continue();
  });
}

test.describe("Dashboard Admin — dados reais dos cards", () => {
  test("Faturamento mostra o valor agregado por GET /dashboard/resumo, formatado em R$ pt-BR", async ({
    page,
  }) => {
    await seedSession(page);
    await mockDashboardApis(page);

    await page.goto(DASHBOARD_URL);

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

  test("Categorias mostra o total agregado por GET /dashboard/resumo, sem métrica inventada", async ({
    page,
  }) => {
    await seedSession(page);
    await mockDashboardApis(page);

    await page.goto(DASHBOARD_URL);

    const cardCategorias = card(page, "Categorias");
    await expect(cardCategorias.getByText("2", { exact: true })).toBeVisible();
  });

  test("loading: mostra skeleton enquanto GET /dashboard/resumo está em andamento", async ({ page }) => {
    await seedSession(page);

    // Segura a resposta atrás de uma Promise controlada manualmente em vez
    // de um delay fixo: evita corrida entre o timing do teste e o tempo
    // real da requisição (um `delayMs` fixo poderia já ter decorrido antes
    // da asserção "ainda em loading" rodar, tornando o teste flaky).
    let liberarResposta!: () => void;
    const respostaLiberada = new Promise<void>((resolve) => {
      liberarResposta = resolve;
    });
    await mockDashboardApis(page, { status: 200, aguardar: respostaLiberada });

    await page.goto(DASHBOARD_URL);

    // Skeleton.tsx: raiz aria-hidden + relative overflow-hidden — um por
    // card, 6 cards ao todo (Faturamento/Pedidos/Produtos/Categorias/
    // Estoque baixo/Clientes, todos compartilham o mesmo `loading` — ver
    // app/workspace-x/page.tsx). GET /alertas já resolvido (mockado sem
    // atraso), então o AlertasPanel não soma nenhum skeleton extra aqui.
    await expect(page.locator('[aria-hidden="true"].relative.overflow-hidden')).toHaveCount(6);
    await expect(page.getByText("R$ 150,75")).toHaveCount(0);

    liberarResposta();

    await expect(page.getByText("R$ 150,75")).toBeVisible();
    await expect(page.locator('[aria-hidden="true"].relative.overflow-hidden')).toHaveCount(0);
  });

  // Substitui o antigo "erro em uma API não impede as outras de carregar":
  // com 3 endpoints independentes, uma falha isolada em /produtos não
  // afetava /pedidos nem /categorias. Isso não existe mais — GET
  // /dashboard/resumo é um endpoint único (ver app/workspace-x/page.tsx:
  // "não há mais como um card carregar e outro falhar"), então o
  // comportamento correto a verificar agora é o oposto: uma falha nele
  // derruba os 6 cards JUNTOS, nenhum mostra "0" como se fosse dado real, e
  // a mensagem técnica do backend nunca vaza (500 sempre cai no fallback
  // genérico, ver lib/errors.ts).
  test("erro em GET /dashboard/resumo faz todos os cards mostrarem erro juntos (endpoint único, sem falha independente por card)", async ({
    page,
  }) => {
    await seedSession(page);
    await mockDashboardApis(page, {
      status: 500,
      body: { message: "detalhe técnico do backend" },
    });

    await page.goto(DASHBOARD_URL);

    const mensagensDeErro = page.getByText("Não foi possível carregar.", { exact: true });
    await expect(mensagensDeErro).toHaveCount(6);
    await expect(card(page, "Faturamento").getByText("0", { exact: true })).toHaveCount(0);
    await expect(card(page, "Produtos").getByText("0", { exact: true })).toHaveCount(0);
    await expect(page.getByText("detalhe técnico do backend")).toHaveCount(0);
  });

  test("lista vazia é um estado diferente de erro (0 real, não falha)", async ({ page }) => {
    await seedSession(page);
    await mockDashboardApis(page, { status: 200, body: RESUMO_VAZIO });

    await page.goto(DASHBOARD_URL);

    await expect(card(page, "Faturamento").getByText("R$ 0,00")).toBeVisible();
    await expect(card(page, "Pedidos").getByText("Nenhum pedido registrado")).toBeVisible();
    await expect(card(page, "Produtos").getByText("Nenhum produto cadastrado")).toBeVisible();
    await expect(card(page, "Categorias").getByText("Nenhuma categoria cadastrada")).toBeVisible();
  });

  // Substitui o antigo "VENDEDOR também vê os cards com dados reais": desde
  // a etapa de Alertas Operacionais, GET /dashboard/resumo passou a ser
  // ADMIN-only (decisão explícita daquela etapa — ver
  // backend/src/dashboard/dashboard.controller.ts). VENDEDOR continua
  // entrando em /workspace-x normalmente (ProtectedLayout é STAFF_ROLES,
  // intocado), mas o backend agora recusa a agregação para esse perfil — o
  // teste passa a verificar que isso não quebra a página, só mostra o
  // estado de erro já existente, nunca dado real nem uma tela em branco.
  test("VENDEDOR abre o Dashboard normalmente, mas GET /dashboard/resumo é ADMIN-only: cards mostram erro, nunca dado real", async ({
    page,
  }) => {
    await seedSession(page, "VENDEDOR", "vendedor@sensora.dev");
    // Mesma mensagem que o RolesGuard real lança para qualquer rota
    // ADMIN-only acessada por um perfil sem permissão (ver
    // backend/src/common/guards/roles.guard.ts) — 403 nunca cai no fallback
    // genérico (só 5xx cai, ver lib/errors.ts), então o card mostra essa
    // mensagem tal como o backend a devolve.
    await mockDashboardApis(page, { status: 403, body: { message: "Acesso negado" } });

    await page.goto(DASHBOARD_URL);

    await expect(page.getByRole("heading", { name: "Dashboard Sensora" })).toBeVisible();
    await expect(card(page, "Faturamento").getByText("Acesso negado")).toBeVisible();
    await expect(page.getByText("R$ 150,75")).toHaveCount(0);
  });
});

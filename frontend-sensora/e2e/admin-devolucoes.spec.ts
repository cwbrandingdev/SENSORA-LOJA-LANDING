import { test, expect, type Page } from "@playwright/test";

// Etapa 7 — fila e análise das devoluções no Workspace-X
// (/workspace-x/devolucoes e /workspace-x/devolucoes/[id]). Backend real
// indisponível neste ambiente: toda chamada é simulada via page.route com
// padrão "**/" (qualquer origem), como nas suítes recentes.

const TOKEN_KEY = "sensora_token";
const FILA_URL = "/workspace-x/devolucoes";
const DETALHE_URL = "/workspace-x/devolucoes/1";
const PNG_1X1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

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

const FILA = [
  {
    id: 1,
    pedidoId: 10,
    pedidoNumero: "PED-10",
    clienteNome: "Ana Cliente",
    clienteEmail: "ana@sensora.dev",
    status: "SOLICITADA",
    solicitadaEm: "2026-09-25T12:00:00.000Z",
    analisadaEm: null,
    quantidadeItens: 2,
    quantidadeFotos: 1,
  },
  {
    id: 2,
    pedidoId: 11,
    pedidoNumero: "PED-11",
    clienteNome: "Bruno Cliente",
    clienteEmail: "bruno@sensora.dev",
    status: "APROVADA",
    solicitadaEm: "2026-09-20T12:00:00.000Z",
    analisadaEm: "2026-09-21T12:00:00.000Z",
    quantidadeItens: 1,
    quantidadeFotos: 0,
  },
];

function analise(extras: Record<string, unknown> = {}) {
  return {
    id: 1,
    status: "SOLICITADA",
    motivo: "Chegou quebrada",
    descricao: "Tampa rachada",
    solicitadaEm: "2026-09-25T12:00:00.000Z",
    analisadaEm: null,
    observacaoAnalise: null,
    analisadoPorNome: null,
    pedido: {
      id: 10,
      numero: "PED-10",
      data: "2026-09-10T00:00:00.000Z",
      status: "PAGO",
      statusEnvio: "ENVIADO",
      enviadoEm: "2026-09-12T10:00:00.000Z",
      total: 179.7,
    },
    cliente: { nome: "Ana Cliente", email: "ana@sensora.dev" },
    itens: [
      {
        id: 1,
        itemPedidoId: 100,
        produtoNome: "Vela Lavanda",
        quantidade: 2,
        quantidadeComprada: 3,
        precoUnitario: 59.9,
      },
    ],
    evidencias: [{ id: 7, url: PNG_1X1, criadoEm: "2026-09-25T12:05:00.000Z" }],
    ...extras,
  };
}

// GET /admin/devolucoes(?status=) — filtra a fila como o backend.
async function mockFila(page: Page): Promise<{ statusPedidos: (string | null)[] }> {
  const chamadas = { statusPedidos: [] as (string | null)[] };
  await page.route("**/admin/devolucoes*", async (route) => {
    const status = new URL(route.request().url()).searchParams.get("status");
    chamadas.statusPedidos.push(status);
    await route.fulfill({ json: FILA.filter((d) => !status || d.status === status) });
  });
  return chamadas;
}

// GET/POST /admin/devolucoes/1... com estado. `conflito`: a decisão responde
// 409 e, como se outro admin tivesse aprovado, o próximo GET já vem APROVADA.
async function mockDetalhe(
  page: Page,
  options: { conflito?: boolean } = {},
): Promise<{ decisoes: { acao: string; corpo: unknown }[] }> {
  let atual = analise();
  const chamadas = { decisoes: [] as { acao: string; corpo: unknown }[] };

  await page.route("**/admin/devolucoes/1**", async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({ json: atual });
      return;
    }

    const acao = request.url().endsWith("/aprovar") ? "aprovar" : "recusar";
    const corpo = request.postDataJSON() as { observacao?: string };
    chamadas.decisoes.push({ acao, corpo });

    if (options.conflito) {
      atual = analise({
        status: "APROVADA",
        analisadaEm: "2026-09-26T09:00:00.000Z",
        analisadoPorNome: "Outro Admin",
      });
      await route.fulfill({
        status: 409,
        json: { statusCode: 409, message: "Devolução com status APROVADA não pode mais ser analisada." },
      });
      return;
    }

    atual = analise({
      status: acao === "aprovar" ? "APROVADA" : "RECUSADA",
      analisadaEm: "2026-09-26T09:00:00.000Z",
      analisadoPorNome: "Admin Sensora",
      observacaoAnalise: corpo.observacao ?? null,
    });
    await route.fulfill({ json: atual });
  });
  return chamadas;
}

function linhaDaFila(page: Page, texto: string) {
  return page.getByRole("row").filter({ hasText: texto });
}

test.describe("Admin — Devoluções (Etapa 7)", () => {
  test("fila mostra devolução, pedido, cliente, status, data, itens e fotos", async ({ page }) => {
    await seedSession(page);
    await mockFila(page);

    await page.goto(FILA_URL);

    const primeira = linhaDaFila(page, "PED-10");
    await expect(primeira).toContainText("#1");
    await expect(primeira).toContainText("Ana Cliente");
    await expect(primeira).toContainText("ana@sensora.dev");
    await expect(primeira).toContainText("Solicitada");
    await expect(primeira.getByRole("cell").nth(5)).toHaveText("2");
    await expect(primeira.getByRole("cell").nth(6)).toHaveText("1");
    await expect(linhaDaFila(page, "PED-11")).toContainText("Aprovada");
  });

  test("filtro por status pede ao backend e mostra só as do status escolhido", async ({
    page,
  }) => {
    await seedSession(page);
    const chamadas = await mockFila(page);

    await page.goto(FILA_URL);
    await expect(linhaDaFila(page, "PED-10")).toBeVisible();
    await page.getByLabel("Status").selectOption("APROVADA");

    await expect(linhaDaFila(page, "PED-11")).toBeVisible();
    await expect(linhaDaFila(page, "PED-10")).toHaveCount(0);
    expect(chamadas.statusPedidos).toContain("APROVADA");
  });

  test("detalhe mostra pedido, cliente, solicitação, itens e fotos", async ({ page }) => {
    await seedSession(page);
    await mockFila(page);
    await mockDetalhe(page);

    await page.goto(FILA_URL);
    await page.getByRole("link", { name: "#1" }).click();

    await expect(page.getByRole("heading", { name: "Devolução #1" })).toBeVisible();
    const pedido = page.getByRole("region", { name: "Pedido" });
    await expect(pedido.getByRole("link", { name: "PED-10" })).toHaveAttribute(
      "href",
      "/workspace-x/pedidos/10",
    );
    await expect(pedido).toContainText("Pago");
    await expect(pedido).toContainText("Enviado em");
    await expect(pedido).toContainText("R$ 179,70");
    await expect(pedido).toContainText("Ana Cliente");

    const solicitacao = page.getByRole("region", { name: "Solicitação" });
    await expect(solicitacao).toContainText("Chegou quebrada");
    await expect(solicitacao).toContainText("Tampa rachada");

    const item = page.getByRole("table", { name: "Itens da devolução" }).getByRole("row", {
      name: /Vela Lavanda/,
    });
    await expect(item.getByRole("cell")).toHaveText(["Vela Lavanda", "2", "3", "R$ 59,90"]);

    await expect(
      page.getByRole("region", { name: "Fotos" }).getByRole("img", {
        name: "Foto enviada pelo cliente",
      }),
    ).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Aprovar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Recusar" })).toBeVisible();
  });

  test("aprovar com observação: envia só a observação e atualiza a tela", async ({ page }) => {
    await seedSession(page);
    const chamadas = await mockDetalhe(page);

    await page.goto(DETALHE_URL);
    await page.getByRole("button", { name: "Aprovar" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Observação (opcional)").fill("Pode enviar");
    await dialog.getByRole("button", { name: "Aprovar" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Aprovada", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Solicitação" })).toContainText("Admin Sensora");
    await expect(page.getByRole("button", { name: "Aprovar" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Recusar" })).toHaveCount(0);
    expect(chamadas.decisoes).toEqual([{ acao: "aprovar", corpo: { observacao: "Pode enviar" } }]);
  });

  test("aprovar sem observação envia corpo vazio", async ({ page }) => {
    await seedSession(page);
    const chamadas = await mockDetalhe(page);

    await page.goto(DETALHE_URL);
    await page.getByRole("button", { name: "Aprovar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Aprovar" }).click();

    await expect(page.getByText("Aprovada", { exact: true })).toBeVisible();
    expect(chamadas.decisoes).toEqual([{ acao: "aprovar", corpo: {} }]);
  });

  test("recusar exige o motivo; com o motivo, recusa e atualiza", async ({ page }) => {
    await seedSession(page);
    const chamadas = await mockDetalhe(page);

    await page.goto(DETALHE_URL);
    await page.getByRole("button", { name: "Recusar" }).click();
    const dialog = page.getByRole("dialog");

    await dialog.getByLabel("Motivo da recusa").fill("   ");
    await dialog.getByRole("button", { name: "Recusar" }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Informe o motivo da recusa.");
    expect(chamadas.decisoes).toHaveLength(0);

    await dialog.getByLabel("Motivo da recusa").fill("Produto com sinais de uso");
    await dialog.getByRole("button", { name: "Recusar" }).click();

    await expect(page.getByText("Recusada", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Solicitação" })).toContainText(
      "Produto com sinais de uso",
    );
    await expect(page.getByRole("button", { name: "Recusar" })).toHaveCount(0);
    expect(chamadas.decisoes).toEqual([
      { acao: "recusar", corpo: { observacao: "Produto com sinais de uso" } },
    ]);
  });

  test("409: mostra a mensagem e recarrega a devolução com o estado atual", async ({ page }) => {
    await seedSession(page);
    await mockDetalhe(page, { conflito: true });

    await page.goto(DETALHE_URL);
    await page.getByRole("button", { name: "Aprovar" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Aprovar" }).click();

    await expect(
      page.getByText("Devolução com status APROVADA não pode mais ser analisada."),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Aprovada", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Solicitação" })).toContainText("Outro Admin");
    await expect(page.getByRole("button", { name: "Aprovar" })).toHaveCount(0);
  });

  test("ADMIN vê Devoluções no menu", async ({ page }) => {
    await seedSession(page, "ADMIN");
    await mockFila(page);

    await page.goto(FILA_URL);

    await expect(
      page
        .getByRole("navigation", { name: "Navegação administrativa" })
        .getByRole("link", { name: "Devoluções" }),
    ).toBeVisible();
  });

  test("VENDEDOR não vê Devoluções no menu e a página não carrega dados", async ({ page }) => {
    await seedSession(page, "VENDEDOR");
    const chamadas = await mockFila(page);

    await page.goto(FILA_URL);

    await expect(page.getByText("Acesso restrito a administradores.")).toBeVisible();
    await expect(
      page
        .getByRole("navigation", { name: "Navegação administrativa" })
        .getByRole("link", { name: "Devoluções" }),
    ).toHaveCount(0);
    expect(chamadas.statusPedidos).toHaveLength(0);
  });

  test("alerta de devoluções no dashboard abre a fila", async ({ page }) => {
    await seedSession(page);
    await mockFila(page);
    await page.route("**/dashboard/resumo", (route) =>
      route.fulfill({
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
      }),
    );
    await page.route("**/alertas", (route) =>
      route.fulfill({
        json: [
          {
            tipo: "DEVOLUCAO_SOLICITADA",
            severidade: "warning",
            titulo: "Devoluções aguardando análise",
            quantidade: 1,
            link: "/workspace-x/devolucoes",
          },
        ],
      }),
    );

    await page.goto("/workspace-x");
    await page.getByRole("link", { name: /Devoluções aguardando análise/ }).click();

    await expect(page).toHaveURL(/\/workspace-x\/devolucoes$/);
    await expect(page.getByRole("heading", { name: "Devoluções" })).toBeVisible();
    await expect(linhaDaFila(page, "PED-10")).toBeVisible();
  });
});

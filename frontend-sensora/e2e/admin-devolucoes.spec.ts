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
    recebidaEm: null,
    envio: null,
    ...extras,
  };
}

// Etapa 8 — cotação da logística reversa (só PAC/SEDEX).
const OPCOES_FRETE = [
  { id: 1, transportadora: "Correios", servico: "PAC", preco: 25.35, prazoDias: 6 },
  { id: 2, transportadora: "Correios", servico: "SEDEX", preco: 41.2, prazoDias: 2 },
];

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
    // Etapa 8 — depois de aprovada, a seção de logística cota o frete.
    if (request.url().endsWith("/frete-devolucao")) {
      await route.fulfill({ json: OPCOES_FRETE });
      return;
    }
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

// Fila redesenhada (DevolucoesFila): cada devolução é um link para o detalhe.
function linhaDaFila(page: Page, texto: string) {
  return page.getByRole("link").filter({ hasText: texto });
}

// As abas mostram a contagem no nome ("Em andamento 1").
function abaDaFila(page: Page, titulo: string) {
  return page.getByRole("button", { name: new RegExp(`^${titulo}`) });
}

test.describe("Admin — Devoluções (Etapa 7)", () => {
  test("fila mostra devolução, pedido, cliente, status, data, itens e fotos", async ({ page }) => {
    await seedSession(page);
    await mockFila(page);

    await page.goto(FILA_URL);

    const primeira = linhaDaFila(page, "PED-10");
    await expect(primeira).toContainText("#1");
    await expect(primeira).toContainText("Ana Cliente");
    await expect(primeira).toContainText("PED-10");
    await expect(primeira).toContainText("Solicitada");
    await expect(primeira).toContainText("2 itens");
    await expect(primeira).toContainText("1 fotos");

    // APROVADA fica na aba "Em andamento".
    await abaDaFila(page, "Em andamento").click();
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
    // O filtro recarrega a fila (que volta para a aba padrão): espera o
    // resultado filtrado antes de trocar de aba. APROVADA fica em
    // "Em andamento".
    await expect(abaDaFila(page, "Precisa de ação")).toContainText("0");
    await abaDaFila(page, "Em andamento").click();

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

// Etapa 8 — logística de devolução no detalhe (/admin/devolucoes/1/...),
// com estado. `falharGeracao`: a primeira geração responde erro (saldo) e,
// como no backend, deixa a geração em andamento (envio sem geradaEm).
// `custoMudou`: a primeira geração responde 409 porque o envio criado no
// Melhor Envio custa mais do que o confirmado (nada é cobrado).
const ENVIO_GERADO = {
  servicoId: 2,
  transportadora: "Correios",
  servico: "SEDEX",
  custo: 40.9,
  compradaEm: "2026-09-30T13:00:00.000Z",
  geradaEm: "2026-09-30T13:01:00.000Z",
  codigoDevolucao: "1234567890",
  codigoRastreio: "ME2600000001BR",
  postadaEm: null,
  situacaoRastreio: null,
  rastreioAtualizadoEm: null,
};

async function mockLogistica(
  page: Page,
  inicial: Record<string, unknown>,
  options: { falharGeracao?: boolean; custoMudou?: boolean } = {},
) {
  let atual = analise({ analisadaEm: "2026-09-26T09:00:00.000Z", ...inicial });
  let falhar = options.falharGeracao ?? false;
  let custoMudou = options.custoMudou ?? false;
  const chamadas = { geracoes: [] as unknown[], documentos: 0, cotacoes: 0 };

  await page.route("**/admin/devolucoes/1**", async (route) => {
    const request = route.request();
    const url = request.url();
    const metodo = request.method();

    if (url.endsWith("/frete-devolucao")) {
      chamadas.cotacoes += 1;
      await route.fulfill({ json: OPCOES_FRETE });
    } else if (url.endsWith("/logistica") && metodo === "POST") {
      chamadas.geracoes.push(request.postDataJSON());
      if (custoMudou) {
        custoMudou = false;
        atual = analise({
          ...atual,
          envio: {
            ...ENVIO_GERADO,
            custo: 45.5,
            compradaEm: null,
            geradaEm: null,
            codigoDevolucao: null,
            codigoRastreio: null,
          },
        });
        await route.fulfill({
          status: 409,
          json: {
            statusCode: 409,
            message:
              "O custo do envio informado pelo Melhor Envio é R$ 45,50, maior que o confirmado (R$ 41,20). Nada foi cobrado; confirme o novo valor para continuar.",
          },
        });
        return;
      }
      if (falhar) {
        falhar = false;
        atual = analise({
          ...atual,
          envio: {
            ...ENVIO_GERADO,
            compradaEm: null,
            geradaEm: null,
            codigoDevolucao: null,
            codigoRastreio: null,
          },
        });
        await route.fulfill({
          status: 502,
          json: {
            statusCode: 502,
            message: "Saldo insuficiente na carteira do Melhor Envio para comprar o envio da devolução.",
            code: "LOGISTICA_MELHOR_ENVIO_INDISPONIVEL",
          },
        });
        return;
      }
      atual = analise({ ...atual, status: "AGUARDANDO_ENVIO", envio: ENVIO_GERADO });
      await route.fulfill({ json: atual });
    } else if (url.endsWith("/documento")) {
      chamadas.documentos += 1;
      await route.fulfill({ json: { url: "https://melhorenvio.com.br/imprimir/abc123" } });
    } else if (url.endsWith("/rastreio")) {
      atual = analise({
        ...atual,
        status: "ENVIADA",
        envio: {
          ...ENVIO_GERADO,
          postadaEm: "2026-10-01T12:00:00.000Z",
          situacaoRastreio: "posted",
          rastreioAtualizadoEm: "2026-10-01T13:00:00.000Z",
        },
      });
      await route.fulfill({ json: atual });
    } else if (url.endsWith("/recebida")) {
      atual = analise({ ...atual, status: "RECEBIDA", recebidaEm: "2026-10-03T10:00:00.000Z" });
      await route.fulfill({ json: atual });
    } else {
      await route.fulfill({ json: atual });
    }
  });
  return chamadas;
}

function secaoLogistica(page: Page) {
  return page.getByRole("region", { name: "Logística de devolução" });
}

test.describe("Workspace-X — Logística de devolução (Etapa 8)", () => {
  test("APROVADA: cota, ADMIN escolhe o serviço, confirma o custo e gera o código de devolução", async ({
    page,
  }) => {
    await seedSession(page);
    const chamadas = await mockLogistica(page, { status: "APROVADA" });

    await page.goto(DETALHE_URL);
    const secao = secaoLogistica(page);
    await expect(secao.getByRole("radio")).toHaveCount(2);
    await expect(secao).toContainText("Correios PAC");
    await expect(secao).toContainText("R$ 25,35");
    await expect(secao).toContainText("Correios SEDEX");
    await expect(secao).toContainText("R$ 41,20");

    const gerar = secao.getByRole("button", { name: "Gerar código de devolução" });
    await expect(gerar).toBeDisabled();
    await secao.getByRole("radio", { name: /SEDEX/ }).check();
    await gerar.click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("R$ 41,20");
    await expect(dialog).toContainText("carteira do Melhor Envio");
    expect(chamadas.geracoes).toHaveLength(0);
    await dialog.getByRole("button", { name: "Gerar código de devolução" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(chamadas.geracoes).toEqual([{ servicoId: 2, custoConfirmado: 41.2 }]);
    await expect(page.getByText("Aguardando envio", { exact: true })).toBeVisible();
    await expect(secao).toContainText("Código de devolução");
    await expect(secao).toContainText("1234567890");
    await expect(secao).toContainText("ME2600000001BR");
    await expect(secao).toContainText("R$ 40,90");
    await expect(secao.getByRole("button", { name: "Documento do envio" })).toBeVisible();
    await expect(secao.getByRole("button", { name: "Atualizar rastreio" })).toBeVisible();
    await expect(secao.getByRole("button", { name: "Confirmar recebimento" })).toHaveCount(0);
    // O documento do envio (secundário) não é pedido enquanto ninguém clica.
    expect(chamadas.documentos).toBe(0);
  });

  test("cancelar a confirmação não gera nada", async ({ page }) => {
    await seedSession(page);
    const chamadas = await mockLogistica(page, { status: "APROVADA" });

    await page.goto(DETALHE_URL);
    const secao = secaoLogistica(page);
    await secao.getByRole("radio", { name: /PAC/ }).check();
    await secao.getByRole("button", { name: "Gerar código de devolução" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Voltar" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(chamadas.geracoes).toHaveLength(0);
  });

  test("erro na geração (saldo): mostra a mensagem e retoma com o mesmo serviço", async ({
    page,
  }) => {
    await seedSession(page);
    const chamadas = await mockLogistica(page, { status: "APROVADA" }, { falharGeracao: true });

    await page.goto(DETALHE_URL);
    const secao = secaoLogistica(page);
    await secao.getByRole("radio", { name: /SEDEX/ }).check();
    await secao.getByRole("button", { name: "Gerar código de devolução" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Gerar código de devolução" }).click();

    await expect(
      page.getByText("Saldo insuficiente na carteira do Melhor Envio para comprar o envio da devolução."),
    ).toBeVisible();
    await expect(secao).toContainText("começou mas não terminou");
    await expect(secao.getByRole("radio")).toHaveCount(0);

    await secao.getByRole("button", { name: "Gerar código de devolução" }).click();
    await expect(page.getByRole("dialog")).toContainText("R$ 40,90");
    await page.getByRole("dialog").getByRole("button", { name: "Gerar código de devolução" }).click();

    await expect(secao).toContainText("ME2600000001BR");
    expect(chamadas.geracoes).toEqual([
      { servicoId: 2, custoConfirmado: 41.2 },
      { servicoId: 2, custoConfirmado: 40.9 },
    ]);
  });

  test("custo do envio maior que o confirmado: nada é cobrado, mostra o novo valor e o ADMIN confirma de novo", async ({
    page,
  }) => {
    await seedSession(page);
    const chamadas = await mockLogistica(page, { status: "APROVADA" }, { custoMudou: true });

    await page.goto(DETALHE_URL);
    const secao = secaoLogistica(page);
    await secao.getByRole("radio", { name: /SEDEX/ }).check();
    await secao.getByRole("button", { name: "Gerar código de devolução" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Gerar código de devolução" })
      .click();

    await expect(page.getByText(/maior que o confirmado \(R\$ 41,20\)/)).toBeVisible();
    await expect(secao).toContainText("R$ 45,50");

    await secao.getByRole("button", { name: "Gerar código de devolução" }).click();
    await expect(page.getByRole("dialog")).toContainText("R$ 45,50");
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Gerar código de devolução" })
      .click();

    await expect(secao).toContainText("1234567890");
    expect(chamadas.geracoes).toEqual([
      { servicoId: 2, custoConfirmado: 41.2 },
      { servicoId: 2, custoConfirmado: 45.5 },
    ]);
  });

  test("Documento do envio (secundário) pede a URL na hora e abre em outra aba", async ({ page }) => {
    await seedSession(page);
    await page.addInitScript(() => {
      (window as unknown as { aberturas: string[] }).aberturas = [];
      window.open = ((url: string) => {
        (window as unknown as { aberturas: string[] }).aberturas.push(url);
        return null;
      }) as typeof window.open;
    });
    const chamadas = await mockLogistica(page, {
      status: "AGUARDANDO_ENVIO",
      envio: ENVIO_GERADO,
    });

    await page.goto(DETALHE_URL);
    await secaoLogistica(page).getByRole("button", { name: "Documento do envio" }).click();

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { aberturas: string[] }).aberturas))
      .toEqual(["https://melhorenvio.com.br/imprimir/abc123"]);
    expect(chamadas.documentos).toBe(1);
    expect(chamadas.cotacoes).toBe(0);
  });

  test("rastreio mostra a postagem (ENVIADA) e o ADMIN confirma o recebimento (RECEBIDA)", async ({
    page,
  }) => {
    await seedSession(page);
    await mockLogistica(page, { status: "AGUARDANDO_ENVIO", envio: ENVIO_GERADO });

    await page.goto(DETALHE_URL);
    const secao = secaoLogistica(page);
    await secao.getByRole("button", { name: "Atualizar rastreio" }).click();

    await expect(page.getByText("Enviada", { exact: true })).toBeVisible();
    await expect(secao).toContainText("posted");

    await secao.getByRole("button", { name: "Confirmar recebimento" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirmar recebimento" })
      .click();

    await expect(page.getByText("Recebida", { exact: true })).toBeVisible();
    await expect(secao.getByRole("button", { name: "Confirmar recebimento" })).toHaveCount(0);
    await expect(secao.getByRole("button", { name: "Atualizar rastreio" })).toHaveCount(0);
  });

  test("devolução ainda em análise não mostra a logística nem cota frete", async ({ page }) => {
    await seedSession(page);
    const chamadas = await mockLogistica(page, { status: "SOLICITADA", analisadaEm: null });

    await page.goto(DETALHE_URL);
    await expect(page.getByRole("button", { name: "Aprovar" })).toBeVisible();
    await expect(secaoLogistica(page)).toHaveCount(0);
    expect(chamadas.cotacoes).toBe(0);
  });
});

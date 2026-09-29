import { test, expect, type Page } from "@playwright/test";

// Etapa 5B.7 (Frontend do Fluxo de Reembolso) — suíte E2E de
// /conta/pedidos/[id], cobrindo a ação "Solicitar reembolso"
// (POST /pedidos/meus/:id/cancelar-pago) somada à regressão do cancelamento
// PENDENTE (POST /pedidos/meus/:id/cancelar, Etapa 5A) que já existia nesta
// página. Mesmo padrão de mocks de e2e/checkout.spec.ts: não existe backend
// real neste ambiente de teste, então toda chamada de API é interceptada via
// page.route com respostas controladas.
const TOKEN_KEY = "sensora_token";
const PEDIDO_ID = 42;
const PEDIDO_URL = `/conta/pedidos/${PEDIDO_ID}`;

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

type PedidoFake = {
  id: number;
  numero: string;
  data: string;
  status: string;
  total: number;
  statusEnvio?: string;
};

function pedidoBase(status: string): PedidoFake {
  return {
    id: PEDIDO_ID,
    numero: "PED-42",
    data: "2026-08-20T12:00:00.000Z",
    status,
    total: 119.8,
  };
}

const ITEM_DETALHADO = {
  id: 1,
  pedidoId: PEDIDO_ID,
  produtoId: 101,
  produtoNome: "Vela Aromática Lavanda",
  produtoImagemUrl: null,
  quantidade: 2,
  precoUnitario: 59.9,
  subtotal: 119.8,
};

// GET /pedidos/meus/:id (buscarMeuPedido) — `pedidoRef` é um objeto mutável
// para que os testes de sucesso consigam refletir a mudança de status
// devolvida pelo POST sem precisar reconfigurar o mock a cada passo (mesmo
// raciocínio de `pedidoFake` no backend, aqui do lado do frontend).
async function mockBuscarMeuPedido(page: Page, pedidoRef: { current: PedidoFake }) {
  await page.route(`**/pedidos/meus/${PEDIDO_ID}`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    await route.fulfill({
      json: { pedido: pedidoRef.current, itens: [ITEM_DETALHADO], total: 119.8 },
    });
  });
}

async function mockCancelarPago(
  page: Page,
  pedidoRef: { current: PedidoFake },
  options: { status?: number; message?: string; delayMs?: number } = {},
) {
  const { status = 200, message, delayMs = 0 } = options;
  await page.route(`**/pedidos/meus/${PEDIDO_ID}/cancelar-pago`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    if (status >= 300) {
      await route.fulfill({
        status,
        json: message === undefined ? {} : { statusCode: status, message },
      });
      return;
    }
    pedidoRef.current = { ...pedidoRef.current, status: "REEMBOLSO_SOLICITADO" };
    await route.fulfill({ status, json: pedidoRef.current });
  });
}

async function mockCancelar(page: Page, pedidoRef: { current: PedidoFake }) {
  await page.route(`**/pedidos/meus/${PEDIDO_ID}/cancelar`, async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }
    pedidoRef.current = { ...pedidoRef.current, status: "CANCELADO" };
    await route.fulfill({ status: 200, json: pedidoRef.current });
  });
}

// StatusPedidoBadge (<span> arredondado) reaproveita o mesmo texto de status
// que AcompanhamentoPedido usa como label de etapa (<p>) — e também pode
// colidir com o texto de um toast (ex.: "Pedido cancelado com sucesso.",
// já que `hasText` normaliza espaço/maiúscula por padrão). Regex ancorada
// (^...$) exige o <span> cujo texto é EXATAMENTE o status, igual ao
// raciocínio de escopo já usado em e2e/checkout.spec.ts para
// "Vela Aromática Lavanda" (produto vs. resumo).
function statusBadge(page: Page, texto: string) {
  return page.locator("span", { hasText: new RegExp(`^${texto}$`) });
}

function countPostCalls(page: Page, path: string): { count: number } {
  const contador = { count: 0 };
  page.on("request", (request) => {
    if (request.url().includes(path) && request.method() === "POST") {
      contador.count += 1;
    }
  });
  return contador;
}

// Teste A — PAGO: botão "Solicitar reembolso" aparece.
test("A: pedido PAGO mostra o botão Solicitar reembolso", async ({ page }) => {
  await seedSession(page);
  const pedidoRef = { current: pedidoBase("PAGO") };
  await mockBuscarMeuPedido(page, pedidoRef);

  await page.goto(PEDIDO_URL);

  await expect(page.getByRole("button", { name: "Solicitar reembolso" })).toBeVisible();
});

// Teste B — PENDENTE: botão de reembolso não aparece; cancelamento existente
// continua funcionando (regressão da Etapa 5A).
test("B: pedido PENDENTE não mostra reembolso e o cancelamento continua funcionando", async ({
  page,
}) => {
  await seedSession(page);
  const pedidoRef = { current: pedidoBase("PENDENTE") };
  await mockBuscarMeuPedido(page, pedidoRef);
  await mockCancelar(page, pedidoRef);

  await page.goto(PEDIDO_URL);

  await expect(page.getByRole("button", { name: "Solicitar reembolso" })).toHaveCount(0);
  const cancelarButton = page.getByRole("button", { name: "Cancelar pedido" });
  await expect(cancelarButton).toBeVisible();

  // Etapa 6.1 — a confirmação deixou de ser o window.confirm nativo e passou
  // a usar o mesmo ConfirmDialog do fluxo de reembolso (só a UI de
  // confirmação mudou, a lógica de cancelamento é a mesma de antes).
  await cancelarButton.click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancelar pedido" }).click();

  await expect(page.getByText("Pedido cancelado com sucesso.")).toBeVisible();
  await expect(statusBadge(page, "Cancelado")).toBeVisible();
});

// Teste C — REEMBOLSO_SOLICITADO: botão não aparece; status correto aparece.
test("C: pedido REEMBOLSO_SOLICITADO não mostra o botão e exibe o status correto", async ({
  page,
}) => {
  await seedSession(page);
  const pedidoRef = { current: pedidoBase("REEMBOLSO_SOLICITADO") };
  await mockBuscarMeuPedido(page, pedidoRef);

  await page.goto(PEDIDO_URL);

  await expect(page.getByRole("button", { name: "Solicitar reembolso" })).toHaveCount(0);
  await expect(statusBadge(page, "Reembolso solicitado")).toBeVisible();
  await expect(
    page.getByText("Sua solicitação de reembolso foi recebida e está em processamento."),
  ).toBeVisible();
});

// Teste D — REEMBOLSADO: botão não aparece; status correto aparece.
test("D: pedido REEMBOLSADO não mostra o botão e exibe o status correto", async ({ page }) => {
  await seedSession(page);
  const pedidoRef = { current: pedidoBase("REEMBOLSADO") };
  await mockBuscarMeuPedido(page, pedidoRef);

  await page.goto(PEDIDO_URL);

  await expect(page.getByRole("button", { name: "Solicitar reembolso" })).toHaveCount(0);
  await expect(statusBadge(page, "Reembolsado")).toBeVisible();
});

// Teste E — clique no botão abre o modal de confirmação.
test("E: clicar em Solicitar reembolso abre o modal de confirmação", async ({ page }) => {
  await seedSession(page);
  const pedidoRef = { current: pedidoBase("PAGO") };
  await mockBuscarMeuPedido(page, pedidoRef);

  await page.goto(PEDIDO_URL);
  await page.getByRole("button", { name: "Solicitar reembolso" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("Solicitar reembolso?")).toBeVisible();
  await expect(
    dialog.getByText("Após confirmar, a solicitação será enviada para processamento."),
  ).toBeVisible();
  // Nunca afirma prazo/imediatismo que o backend não garante (item 7 da
  // etapa) — nenhuma dessas frases pode aparecer em lugar nenhum da página.
  const texto = await page.locator("body").innerText();
  expect(texto).not.toMatch(/imediatamente|em \d+ minutos?/i);
});

// Teste F — cancelar o modal não dispara nenhuma chamada POST.
test("F: cancelar o modal não chama a API", async ({ page }) => {
  await seedSession(page);
  const pedidoRef = { current: pedidoBase("PAGO") };
  await mockBuscarMeuPedido(page, pedidoRef);
  await mockCancelarPago(page, pedidoRef);
  const chamadas = countPostCalls(page, "cancelar-pago");

  await page.goto(PEDIDO_URL);
  await page.getByRole("button", { name: "Solicitar reembolso" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Voltar" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(chamadas.count).toBe(0);
  // Status permanece PAGO — nenhuma mudança local sem confirmação do backend.
  await expect(page.getByText("Pago", { exact: true })).toBeVisible();
});

// Teste G — confirmar chama o POST exatamente uma vez.
test("G: confirmar chama POST /pedidos/meus/:id/cancelar-pago exatamente uma vez", async ({
  page,
}) => {
  await seedSession(page);
  const pedidoRef = { current: pedidoBase("PAGO") };
  await mockBuscarMeuPedido(page, pedidoRef);
  await mockCancelarPago(page, pedidoRef);
  const chamadas = countPostCalls(page, "cancelar-pago");

  await page.goto(PEDIDO_URL);
  await page.getByRole("button", { name: "Solicitar reembolso" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Solicitar reembolso" })
    .click();

  await expect(page.getByText("Solicitação de reembolso enviada para processamento.")).toBeVisible();
  expect(chamadas.count).toBe(1);
});

// Teste H — múltiplos cliques durante o loading não geram múltiplas chamadas.
test("H: múltiplos cliques durante o processamento não geram chamadas duplicadas", async ({
  page,
}) => {
  await seedSession(page);
  const pedidoRef = { current: pedidoBase("PAGO") };
  await mockBuscarMeuPedido(page, pedidoRef);
  await mockCancelarPago(page, pedidoRef, { delayMs: 400 });
  const chamadas = countPostCalls(page, "cancelar-pago");

  await page.goto(PEDIDO_URL);
  await page.getByRole("button", { name: "Solicitar reembolso" }).click();
  // Localizado por posição (segundo botão do dialog: Voltar, depois
  // Confirmar), nunca pelo `name` acessível — o rótulo do próprio botão
  // muda para "Processando..." assim que clicado, então um locator preso
  // ao nome original deixaria de encontrar o elemento no passo seguinte.
  const confirmarButton = page.getByRole("dialog").getByRole("button").last();

  await confirmarButton.click();
  await expect(confirmarButton).toBeDisabled();
  await expect(confirmarButton).toContainText("Processando...");
  // Segundo clique enquanto desabilitado — force para garantir que, mesmo
  // que algo ainda aceite o clique nativo, o handler continua bloqueado
  // pelo estado `solicitandoReembolso`.
  await confirmarButton.click({ force: true }).catch(() => {});

  await expect(page.getByText("Solicitação de reembolso enviada para processamento.")).toBeVisible();
  expect(chamadas.count).toBe(1);
});

// Teste I — sucesso: status local passa a REEMBOLSO_SOLICITADO, modal fecha,
// botão de reembolso desaparece.
test("I: sucesso atualiza o status para Reembolso solicitado e remove o botão", async ({
  page,
}) => {
  await seedSession(page);
  const pedidoRef = { current: pedidoBase("PAGO") };
  await mockBuscarMeuPedido(page, pedidoRef);
  await mockCancelarPago(page, pedidoRef);

  await page.goto(PEDIDO_URL);
  await page.getByRole("button", { name: "Solicitar reembolso" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Solicitar reembolso" })
    .click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(statusBadge(page, "Reembolso solicitado")).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicitar reembolso" })).toHaveCount(0);
  // Nunca mostra Reembolsado diretamente após o POST — só REEMBOLSO_SOLICITADO
  // (item 10 da etapa: confirmação definitiva só vem do webhook/backend).
  await expect(statusBadge(page, "Reembolsado")).toHaveCount(0);
});

// Teste J — erro 409: mensagem amigável e atualização do pedido.
test("J: erro 409 mostra mensagem amigável e busca o estado atual do pedido", async ({
  page,
}) => {
  await seedSession(page);
  const pedidoRef = { current: pedidoBase("PAGO") };
  await mockBuscarMeuPedido(page, pedidoRef);
  await mockCancelarPago(page, pedidoRef, {
    status: 409,
    message: "Pedido com status REEMBOLSO_SOLICITADO não pode ser reembolsado.",
  });

  await page.goto(PEDIDO_URL);
  await page.getByRole("button", { name: "Solicitar reembolso" }).click();

  // A resposta de erro não muda pedidoRef.current — simula o cenário real
  // de outra aba/webhook já ter mudado o status no backend nesse meio
  // tempo; o refetch (GET) que segue o 409 deve trazer esse estado real.
  pedidoRef.current = { ...pedidoRef.current, status: "REEMBOLSO_SOLICITADO" };

  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Solicitar reembolso" })
    .click();

  await expect(
    page.getByText("Pedido com status REEMBOLSO_SOLICITADO não pode ser reembolsado."),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(statusBadge(page, "Reembolso solicitado")).toBeVisible();
});

// Teste K — erro 502: nunca afirma que o reembolso foi concluído.
test("K: erro 502 mostra mensagem genérica, nunca afirma sucesso", async ({ page }) => {
  await seedSession(page);
  const pedidoRef = { current: pedidoBase("PAGO") };
  await mockBuscarMeuPedido(page, pedidoRef);
  await mockCancelarPago(page, pedidoRef, { status: 502, message: "O Asaas recusou a requisição" });

  await page.goto(PEDIDO_URL);
  await page.getByRole("button", { name: "Solicitar reembolso" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Solicitar reembolso" })
    .click();

  await expect(
    page.getByText("Não foi possível concluir a solicitação neste momento. Tente novamente."),
  ).toBeVisible();
  // >=500 nunca mostra a mensagem crua do backend (mesma regra de
  // getErrorMessage já testada em e2e/checkout.spec.ts) — aqui confirma que
  // isso vale também para o texto específico do Asaas.
  await expect(page.getByText("O Asaas recusou a requisição")).toHaveCount(0);
  await expect(statusBadge(page, "Reembolsado")).toHaveCount(0);
  await expect(page.getByText("sucesso", { exact: false })).toHaveCount(0);

  // Erro ambíguo (>=500) não fecha o modal sozinho — o usuário decide se
  // tenta de novo ou volta; o botão de confirmação, escopado ao dialog
  // (ainda aberto), precisa ter saído do estado de loading para permitir
  // retry manual.
  const confirmarButton = page
    .getByRole("dialog")
    .getByRole("button", { name: "Solicitar reembolso" });
  await expect(confirmarButton).toBeEnabled();
  await expect(confirmarButton).not.toContainText("Processando...");

  await page.getByRole("dialog").getByRole("button", { name: "Voltar" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  // Status permanece PAGO (o backend, nesse caso ambíguo, pode ou não ter
  // avançado — o frontend nunca decide isso sozinho) e o botão continua
  // disponível para nova tentativa.
  await expect(page.getByText("Pago", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicitar reembolso" })).toBeEnabled();
});

// Teste L — pedido já REEMBOLSADO após refresh: nenhuma nova solicitação
// disponível.
test("L: reabrir a página com o pedido já REEMBOLSADO não oferece nova solicitação", async ({
  page,
}) => {
  await seedSession(page);
  const pedidoRef = { current: pedidoBase("REEMBOLSADO") };
  await mockBuscarMeuPedido(page, pedidoRef);
  const chamadas = countPostCalls(page, "cancelar-pago");

  await page.goto(PEDIDO_URL);
  await page.reload();

  await expect(statusBadge(page, "Reembolsado")).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicitar reembolso" })).toHaveCount(0);
  expect(chamadas.count).toBe(0);
});

// Etapa 4 (Devoluções) — pedido PAGO já ENVIADO troca o reembolso direto pela
// solicitação de devolução (POST /pedidos/meus/:id/devolucoes).
function pedidoEnviado(): PedidoFake {
  return { ...pedidoBase("PAGO"), statusEnvio: "ENVIADO" };
}

// Captura o corpo enviado e responde com o status escolhido.
async function mockDevolucao(
  page: Page,
  options: { status?: number; message?: string } = {},
): Promise<{ corpos: unknown[] }> {
  const { status = 201, message } = options;
  const chamadas = { corpos: [] as unknown[] };
  await page.route(`**/pedidos/meus/${PEDIDO_ID}/devolucoes`, async (route) => {
    chamadas.corpos.push(route.request().postDataJSON());
    if (status >= 300) {
      await route.fulfill({ status, json: { statusCode: status, message } });
      return;
    }
    await route.fulfill({
      status,
      json: {
        id: 1,
        pedidoId: PEDIDO_ID,
        status: "SOLICITADA",
        motivo: "Chegou quebrada",
        descricao: null,
        solicitadaEm: "2026-09-29T12:00:00.000Z",
        itens: [{ id: 1, itemPedidoId: 1, quantidade: 2, precoUnitario: 59.9 }],
      },
    });
  });
  return chamadas;
}

test("M: pedido PAGO e ENVIADO mostra Solicitar devolução no lugar do reembolso", async ({
  page,
}) => {
  await seedSession(page);
  await mockBuscarMeuPedido(page, { current: pedidoEnviado() });

  await page.goto(PEDIDO_URL);

  await expect(page.getByRole("button", { name: "Solicitar devolução" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicitar reembolso" })).toHaveCount(0);
});

test("N: pedido PAGO não enviado continua sem o botão de devolução", async ({ page }) => {
  await seedSession(page);
  await mockBuscarMeuPedido(page, {
    current: { ...pedidoBase("PAGO"), statusEnvio: "NAO_ENVIADO" },
  });

  await page.goto(PEDIDO_URL);

  await expect(page.getByRole("button", { name: "Solicitar reembolso" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicitar devolução" })).toHaveCount(0);
});

test("O: sem item selecionado ou sem motivo não chama a API", async ({ page }) => {
  await seedSession(page);
  await mockBuscarMeuPedido(page, { current: pedidoEnviado() });
  const chamadas = await mockDevolucao(page);

  await page.goto(PEDIDO_URL);
  await page.getByRole("button", { name: "Solicitar devolução" }).click();
  const dialog = page.getByRole("dialog");

  await dialog.getByRole("button", { name: "Enviar solicitação" }).click();
  await expect(dialog.getByRole("alert")).toHaveText(
    "Selecione pelo menos um item para devolver.",
  );

  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Enviar solicitação" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Informe o motivo da devolução.");

  expect(chamadas.corpos).toHaveLength(0);
});

test("P: quantidade limitada ao comprado e envio com o corpo correto", async ({ page }) => {
  await seedSession(page);
  await mockBuscarMeuPedido(page, { current: pedidoEnviado() });
  const chamadas = await mockDevolucao(page);

  await page.goto(PEDIDO_URL);
  await page.getByRole("button", { name: "Solicitar devolução" }).click();
  const dialog = page.getByRole("dialog");

  await dialog.getByRole("checkbox").check();
  const aumentar = dialog.getByRole("button", { name: "Aumentar quantidade" });
  await aumentar.click();
  // Comprou 2: o "+" trava em 2.
  await expect(aumentar).toBeDisabled();

  await dialog.getByLabel("Motivo").fill("  Chegou quebrada  ");
  await dialog.getByLabel("Descrição (opcional)").fill("Tampa rachada");
  await dialog.getByRole("button", { name: "Enviar solicitação" }).click();

  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByText("Sua solicitação de devolução foi registrada e será analisada.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(chamadas.corpos).toEqual([
    {
      motivo: "Chegou quebrada",
      descricao: "Tampa rachada",
      itens: [{ itemPedidoId: 1, quantidade: 2 }],
    },
  ]);
});

test("Q: erro de validação do backend aparece no formulário", async ({ page }) => {
  await seedSession(page);
  await mockBuscarMeuPedido(page, { current: pedidoEnviado() });
  await mockDevolucao(page, {
    status: 400,
    message: "Quantidade indisponível para devolução do item 1: máximo 1.",
  });

  await page.goto(PEDIDO_URL);
  await page.getByRole("button", { name: "Solicitar devolução" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByLabel("Motivo").fill("Chegou quebrada");
  await dialog.getByRole("button", { name: "Enviar solicitação" }).click();

  await expect(dialog.getByRole("alert")).toHaveText(
    "Quantidade indisponível para devolução do item 1: máximo 1.",
  );
  await expect(dialog.getByRole("button", { name: "Enviar solicitação" })).toBeEnabled();
});

// Etapa 5 (Evidências) — fotos opcionais enviadas depois de criar a
// devolução (POST/DELETE /pedidos/meus/:id/devolucoes/:devolucaoId/evidencias,
// GET /pedidos/meus/:id/devolucoes/:devolucaoId). Tudo simulado via
// page.route; a imagem de retorno é um PNG 1x1 em data URL.
const PNG_1X1_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const PNG_1X1 = Buffer.from(PNG_1X1_BASE64, "base64");

function fotoPng(nome: string) {
  return { name: nome, mimeType: "image/png", buffer: PNG_1X1 };
}

type ChamadasEvidencias = {
  envios: { contentType: string; temCampoFoto: boolean }[];
  remocoes: number[];
};

// `falharEnvio`: número do envio (1, 2, ...) que responde erro 400.
async function mockEvidencias(
  page: Page,
  options: { falharEnvio?: number } = {},
): Promise<ChamadasEvidencias> {
  const chamadas: ChamadasEvidencias = { envios: [], remocoes: [] };
  await page.route(`**/pedidos/meus/${PEDIDO_ID}/devolucoes/1**`, async (route) => {
    const request = route.request();
    const url = request.url();

    if (request.method() === "GET") {
      await route.fulfill({
        json: {
          id: 1,
          pedidoId: PEDIDO_ID,
          status: "SOLICITADA",
          motivo: "Chegou quebrada",
          descricao: null,
          solicitadaEm: "2026-09-29T12:00:00.000Z",
          itens: [],
          evidencias: [],
        },
      });
      return;
    }

    if (request.method() === "POST" && url.endsWith("/evidencias")) {
      chamadas.envios.push({
        contentType: request.headers()["content-type"] ?? "",
        temCampoFoto: (request.postDataBuffer() ?? Buffer.alloc(0))
          .toString("latin1")
          .includes('name="foto"'),
      });
      const numero = chamadas.envios.length;
      if (numero === options.falharEnvio) {
        await route.fulfill({
          status: 400,
          json: {
            statusCode: 400,
            message: "Formato não permitido. Envie uma foto JPEG, PNG ou WEBP.",
          },
        });
        return;
      }
      await route.fulfill({
        status: 201,
        json: {
          id: 100 + numero,
          url: `data:image/png;base64,${PNG_1X1_BASE64}`,
          criadoEm: "2026-09-30T10:00:00.000Z",
        },
      });
      return;
    }

    const remocao = url.match(/\/evidencias\/(\d+)$/);
    if (request.method() === "DELETE" && remocao) {
      chamadas.remocoes.push(Number(remocao[1]));
      await route.fulfill({ status: 204 });
      return;
    }

    await route.continue();
  });
  return chamadas;
}

// Cria a devolução pela tela e devolve o bloco de fotos que aparece depois.
async function criarDevolucaoEAbrirFotos(page: Page) {
  await page.goto(PEDIDO_URL);
  await page.getByRole("button", { name: "Solicitar devolução" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").check();
  await dialog.getByLabel("Motivo").fill("Chegou quebrada");
  await dialog.getByRole("button", { name: "Enviar solicitação" }).click();

  const blocoFotos = page.getByRole("region", { name: "Fotos da devolução (opcional)" });
  await expect(blocoFotos).toBeVisible();
  return blocoFotos;
}

async function prepararPedidoEnviado(page: Page, options: { falharEnvio?: number } = {}) {
  await seedSession(page);
  await mockBuscarMeuPedido(page, { current: pedidoEnviado() });
  await mockDevolucao(page);
  return mockEvidencias(page, options);
}

test("R: depois de criar a devolução dá para continuar sem fotos", async ({ page }) => {
  const chamadas = await prepararPedidoEnviado(page);
  const blocoFotos = await criarDevolucaoEAbrirFotos(page);

  await blocoFotos.getByRole("button", { name: "Continuar sem fotos" }).click();

  await expect(blocoFotos).toHaveCount(0);
  await expect(
    page.getByText("Sua solicitação de devolução foi registrada e será analisada.", {
      exact: false,
    }),
  ).toBeVisible();
  expect(chamadas.envios).toHaveLength(0);
});

test("S: seleção mostra prévias e recusa formato e tamanho inválidos", async ({ page }) => {
  const chamadas = await prepararPedidoEnviado(page);
  const blocoFotos = await criarDevolucaoEAbrirFotos(page);

  await blocoFotos.locator('input[type="file"]').setInputFiles([
    fotoPng("a.png"),
    fotoPng("b.png"),
    { name: "notas.txt", mimeType: "text/plain", buffer: Buffer.from("texto") },
    { name: "grande.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) },
  ]);

  await expect(blocoFotos.getByRole("img", { name: "Foto da devolução" })).toHaveCount(2);
  await expect(blocoFotos.getByText("Pronta para enviar")).toHaveCount(2);
  await expect(blocoFotos.getByRole("alert")).toContainText("notas.txt: use JPEG, PNG ou WEBP");
  await expect(blocoFotos.getByRole("alert")).toContainText("grande.png: máximo de 5 MB");
  expect(chamadas.envios).toHaveLength(0);
});

test("T: envia cada foto como multipart no campo foto e mostra Enviada", async ({ page }) => {
  const chamadas = await prepararPedidoEnviado(page);
  const blocoFotos = await criarDevolucaoEAbrirFotos(page);

  await blocoFotos
    .locator('input[type="file"]')
    .setInputFiles([fotoPng("a.png"), fotoPng("b.png")]);
  await blocoFotos.getByRole("button", { name: "Enviar fotos" }).click();

  await expect(blocoFotos.getByText("Enviada", { exact: true })).toHaveCount(2);
  expect(chamadas.envios).toHaveLength(2);
  for (const envio of chamadas.envios) {
    expect(envio.contentType).toMatch(/^multipart\/form-data; boundary=/);
    expect(envio.temCampoFoto).toBe(true);
  }
  await expect(blocoFotos.getByRole("button", { name: "Concluir" })).toBeVisible();
});

test("U: erro em uma foto não perde as enviadas, e tentar de novo reenvia só a que falhou", async ({
  page,
}) => {
  const chamadas = await prepararPedidoEnviado(page, { falharEnvio: 2 });
  const blocoFotos = await criarDevolucaoEAbrirFotos(page);

  await blocoFotos
    .locator('input[type="file"]')
    .setInputFiles([fotoPng("a.png"), fotoPng("b.png")]);
  await blocoFotos.getByRole("button", { name: "Enviar fotos" }).click();

  await expect(blocoFotos.getByText("Enviada", { exact: true })).toHaveCount(1);
  await expect(
    blocoFotos.getByText("Formato não permitido. Envie uma foto JPEG, PNG ou WEBP."),
  ).toBeVisible();

  await blocoFotos.getByRole("button", { name: "Enviar fotos" }).click();

  await expect(blocoFotos.getByText("Enviada", { exact: true })).toHaveCount(2);
  expect(chamadas.envios).toHaveLength(3);
});

test("V: remover antes do envio não chama a API; depois do envio chama o DELETE", async ({
  page,
}) => {
  const chamadas = await prepararPedidoEnviado(page);
  const blocoFotos = await criarDevolucaoEAbrirFotos(page);
  const input = blocoFotos.locator('input[type="file"]');

  await input.setInputFiles([fotoPng("a.png")]);
  await blocoFotos.getByRole("button", { name: "Remover" }).click();
  await expect(blocoFotos.getByRole("img", { name: "Foto da devolução" })).toHaveCount(0);
  expect(chamadas.remocoes).toHaveLength(0);

  await input.setInputFiles([fotoPng("b.png")]);
  await blocoFotos.getByRole("button", { name: "Enviar fotos" }).click();
  await expect(blocoFotos.getByText("Enviada", { exact: true })).toHaveCount(1);
  await blocoFotos.getByRole("button", { name: "Remover" }).click();

  await expect(blocoFotos.getByRole("img", { name: "Foto da devolução" })).toHaveCount(0);
  expect(chamadas.remocoes).toEqual([101]);
});

test("W: no máximo 5 fotos — as excedentes são recusadas com aviso", async ({ page }) => {
  await prepararPedidoEnviado(page);
  const blocoFotos = await criarDevolucaoEAbrirFotos(page);

  await blocoFotos
    .locator('input[type="file"]')
    .setInputFiles(["1", "2", "3", "4", "5", "6"].map((n) => fotoPng(`${n}.png`)));

  await expect(blocoFotos.getByRole("img", { name: "Foto da devolução" })).toHaveCount(5);
  await expect(blocoFotos.getByRole("alert")).toContainText("6.png: limite de 5 fotos");
  // Com 5 fotos, o botão de adicionar some.
  await expect(blocoFotos.getByText("Adicionar fotos")).toHaveCount(0);
});

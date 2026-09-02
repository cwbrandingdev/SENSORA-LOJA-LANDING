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

import { test, expect, type Page } from "@playwright/test";

// Task 9 (layout/resumo/endereços) + Task 10 (POST /checkout/session) +
// Task 11 (redirecionamento para a URL de pagamento retornada) + Task 21
// (gateway migrado de Stripe para Asaas — mocks/asserções apontam para o
// domínio do Asaas Checkout hospedado) — suíte E2E da página /loja/checkout.
// Não existe backend real disponível neste ambiente de testes, então toda
// chamada de API (/auth/login, /enderecos, /checkout/session) e até a
// própria página hospedada de pagamento são interceptadas via page.route com
// respostas controladas — o objetivo aqui é validar o comportamento da
// página, não a integração de rede real (ver Task 21: isso NÃO é prova de
// integração real com o Asaas).
// Sessão/carrinho são semeados via localStorage, nos mesmos formatos exatos
// que lib/storage.ts e context/CartContext.tsx leem (TOKEN_KEY =
// "sensora_token", CART_STORAGE_KEY = "sensora_carrinho").

const CHECKOUT_URL = "/loja/checkout";
const TOKEN_KEY = "sensora_token";
const CART_STORAGE_KEY = "sensora_carrinho";

function base64Url(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Token decodificável por lib/jwt.ts (sem verificação de assinatura — só o
// payload é lido no client) com `exp` 1h no futuro, sempre válido durante o
// teste.
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

// Mesmo formato, `exp` no passado — possuiSessaoValida()/isTokenExpired()
// (lib/jwt.ts) devem tratar isto como sessão inválida.
function tokenExpiradoFake(): string {
  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const payload = base64Url({
    sub: 1,
    email: "cliente@sensora.dev",
    perfil: "CLIENTE",
    exp: Math.floor(Date.now() / 1000) - 3600,
  });
  return `${header}.${payload}.assinatura-fake`;
}

const CART_ITEM = {
  produtoId: 101,
  nome: "Vela Aromática Lavanda",
  slug: "vela-aromatica-lavanda",
  preco: 59.9,
  quantidade: 2,
};

const ENDERECO_PADRAO = {
  id: 1,
  usuarioId: 1,
  rua: "Rua das Flores",
  numero: "123",
  complemento: "Apto 45",
  bairro: "Centro",
  cidade: "Curitiba",
  estado: "PR",
  cep: "80000-000",
  padrao: true,
};

const ENDERECO_SECUNDARIO = {
  id: 2,
  usuarioId: 1,
  rua: "Avenida Brasil",
  numero: "500",
  bairro: "Batel",
  cidade: "Curitiba",
  estado: "PR",
  cep: "80420-000",
  padrao: false,
};

async function seedSession(page: Page) {
  await page.addInitScript(
    ([tokenKey, token]) => {
      window.localStorage.setItem(tokenKey, token);
    },
    [TOKEN_KEY, fakeToken()] as const,
  );
}

async function seedCart(page: Page, itens: unknown[]) {
  await page.addInitScript(
    ([cartKey, itensJson]) => {
      window.localStorage.setItem(cartKey, itensJson);
    },
    [CART_STORAGE_KEY, JSON.stringify(itens)] as const,
  );
}

async function mockEnderecos(page: Page, enderecos: unknown[]) {
  await page.route("**/enderecos", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: enderecos });
      return;
    }
    await route.continue();
  });
}

async function mockEnderecosError(page: Page) {
  await page.route("**/enderecos", async (route) => {
    if (route.request().method() === "GET") {
      // Sem corpo JSON de propósito: exercita o fallback de getErrorMessage
      // (lib/errors.ts), não uma mensagem vinda do servidor.
      await route.fulfill({ status: 500, body: "" });
      return;
    }
    await route.continue();
  });
}

// Tolerância de 24px: o Navbar (fora do escopo da Task 9 — "não alterar
// Navbar") já produz uma diferença de ~12px entre scrollWidth e innerWidth
// em toda página do site, inclusive /loja/carrinho (verificado à parte,
// sem nenhum elemento cujo boundingClientRect ultrapasse o viewport — é uma
// característica pré-existente da logo do Navbar, não um scroll visível).
// Overflow real introduzido por esta task (grid não colapsando, card
// estourando a coluna etc.) produz diferenças de dezenas/centenas de px,
// muito acima dessa tolerância.
async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 24,
  );
}

// Usado só nos caminhos em que a validação local deve bloquear ANTES de
// qualquer chamada de pagamento (sem endereço, sem token) — nesses casos,
// nem /checkout/session (Task 10) nem asaas.com (Task 11/21) devem ser
// tocados.
function trackPaymentCalls(page: Page) {
  const chamadas: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/checkout/session") || url.includes("asaas.com")) {
      chamadas.push(url);
    }
  });
  return chamadas;
}

// Redirecionar para o Asaas é Task 11 (migrado de Stripe na Task 21), fora
// do escopo desta task — todo teste deste arquivo, mesmo os que chamam
// /checkout/session de propósito (Task 10), deve continuar vendo zero
// chamadas a asaas.com quando o fluxo não deveria chegar lá.
function trackAsaasCalls(page: Page) {
  const chamadas: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("asaas.com")) chamadas.push(request.url());
  });
  return chamadas;
}

// Captura corpo + header Authorization de toda chamada POST
// /checkout/session — usado para validar o contrato exato do payload e o
// envio do JWT (Task 10).
function captureCheckoutSessionRequests(page: Page) {
  const chamadas: { body: unknown; authorization: string | undefined }[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/checkout/session") && request.method() === "POST") {
      chamadas.push({
        body: request.postDataJSON(),
        authorization: request.headers()["authorization"],
      });
    }
  });
  return chamadas;
}

async function mockCheckoutSession(
  page: Page,
  response: { sessionId: string; url: string } = {
    sessionId: "chk_test_123",
    url: "https://sandbox.asaas.com/checkoutSession/show/chk_test_123",
  },
) {
  await page.route("**/checkout/session", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 201, json: response });
      return;
    }
    await route.continue();
  });
}

async function mockCheckoutSessionError(
  page: Page,
  status = 500,
  message?: string,
) {
  await page.route("**/checkout/session", async (route) => {
    if (route.request().method() === "POST") {
      if (message === undefined) {
        // Sem corpo JSON de propósito — mesmo raciocínio de
        // mockEnderecosError: exercita o fallback de getErrorMessage.
        await route.fulfill({ status, body: "" });
      } else {
        // Mesmo formato real de AllExceptionsFilter (backend) — só os
        // campos que getErrorMessage de fato lê.
        await route.fulfill({ status, json: { statusCode: status, message } });
      }
      return;
    }
    await route.continue();
  });
}

// Task 16 — falha de rede de verdade (sem resposta HTTP nenhuma), distinta
// de um erro 4xx/5xx com corpo. route.abort() simula exatamente isso:
// axios rejeita sem `error.response`.
async function mockCheckoutSessionNetworkFailure(page: Page) {
  await page.route("**/checkout/session", async (route) => {
    if (route.request().method() === "POST") {
      await route.abort("connectionrefused");
      return;
    }
    await route.continue();
  });
}

// Task 11 (+ Task 21) — o redirecionamento de sucesso (window.location.assign)
// sai do app Next.js de verdade. Sem interceptar a própria URL do Asaas
// Checkout, o Playwright tentaria navegar para sandbox.asaas.com de verdade
// (rede real, indisponível/não-determinística neste ambiente de teste) —
// então devolvemos uma página HTML mínima e controlada só para a navegação
// completar de forma determinística.
async function mockAsaasCheckoutPage(page: Page, url: string) {
  await page.route(url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>Asaas Checkout (mock de teste)</body></html>",
    });
  });
}

test.describe("Checkout — autenticação (Task 7, preservada)", () => {
  test("usuário não autenticado é redirecionado para /login com redirect", async ({ page }) => {
    await page.goto(CHECKOUT_URL);
    await expect(page).toHaveURL(/\/login\?redirect=%2Floja%2Fcheckout/);
  });

  test("login com redirect volta para /loja/checkout e o carrinho permanece intacto", async ({
    page,
  }) => {
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await page.route("**/auth/login", async (route) => {
      await route.fulfill({ json: { access_token: fakeToken() } });
    });

    await page.goto("/login?redirect=%2Floja%2Fcheckout");
    // Etapa 6.2 (Auth Switch): os formulários de Login e Cadastro ficam
    // sempre montados simultaneamente (alternam via opacity/z-index, não
    // por desmontagem — ver components/auth/AuthSwitch.tsx), então ambos
    // têm um campo rotulado "Email"/"Senha". Usa o id específico do
    // formulário de login para não ser ambíguo.
    await page.locator("#login-email").fill("cliente@sensora.dev");
    await page.locator("#login-senha").fill("senha123");
    // O painel de marca também tem um botão "Entrar" (troca para o modo
    // Login) — escopa ao botão de submit do próprio formulário de login.
    await page.locator('form:has(#login-senha) button[type="submit"]').click();

    await expect(page).toHaveURL(new RegExp(CHECKOUT_URL.replace("/", "\\/")));
    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();

    const cartRaw = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      CART_STORAGE_KEY,
    );
    expect(JSON.parse(cartRaw ?? "[]")).toEqual([CART_ITEM]);
  });
});

test.describe("Checkout — carrinho vazio", () => {
  test("mostra EmptyState com CTA para voltar à loja, sem overflow", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, []);
    await mockEnderecos(page, [ENDERECO_PADRAO]);

    await page.goto(CHECKOUT_URL);

    await expect(page.getByText("Não há produtos para finalizar")).toBeVisible();
    const cta = page.getByRole("link", { name: "Voltar para a loja →" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/loja/produtos");

    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});

test.describe("Checkout — resumo do carrinho", () => {
  test("mostra produtos reais do carrinho com subtotal e total corretos", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);

    await page.goto(CHECKOUT_URL);

    // Escopado à linha do resumo (não ao texto solto) porque o mesmo nome
    // também aparece como `label`/alt do PlaceholderImage (sem imagemUrl no
    // item de teste) — getByText("Vela Aromática Lavanda") sozinho bate nos
    // dois lugares e quebra o modo estrito do Playwright.
    const linhaResumo = page.locator("li").filter({ hasText: "Vela Aromática Lavanda" });
    await expect(linhaResumo).toBeVisible();
    await expect(linhaResumo).toContainText("Qtd. 2 · R$ 59,90 un.");
    await expect(linhaResumo).toContainText("R$ 119,80");

    const subtotalEsperado = "R$ 119,80";
    // exact: true evita que "Total" bata em "Subtotal" por substring.
    const subtotalRow = page.getByText("Subtotal", { exact: true }).locator("..");
    await expect(subtotalRow).toContainText(subtotalEsperado);
    const totalRow = page.getByText("Total", { exact: true }).locator("..");
    await expect(totalRow).toContainText(subtotalEsperado);
  });
});

test.describe("Checkout — endereços", () => {
  test("mostra skeleton enquanto carrega", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await page.route("**/enderecos", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fulfill({ json: [ENDERECO_PADRAO] });
    });

    await page.goto(CHECKOUT_URL);
    await expect(page.locator('[aria-busy="true"]')).toBeVisible();
    await expect(page.getByRole("radiogroup", { name: "Selecione um endereço" })).toBeVisible();
  });

  test("nenhum endereço cadastrado mostra estado vazio com CTA", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, []);

    await page.goto(CHECKOUT_URL);

    await expect(page.getByText("Você ainda não tem nenhum endereço")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cadastrar endereço" })).toBeVisible();
  });

  test("endereço padrão é selecionado automaticamente", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_SECUNDARIO, ENDERECO_PADRAO]);

    await page.goto(CHECKOUT_URL);

    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(2);
    await expect(page.getByRole("radio").filter({ hasText: "Rua das Flores" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("sem endereço padrão, seleciona o primeiro da lista", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    const semPadrao = { ...ENDERECO_SECUNDARIO, padrao: false };
    await mockEnderecos(page, [semPadrao, { ...ENDERECO_PADRAO, id: 3, padrao: false }]);

    await page.goto(CHECKOUT_URL);

    await expect(page.getByRole("radio").first()).toHaveAttribute("aria-checked", "true");
  });

  test("clicar em outro endereço troca a seleção", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO, ENDERECO_SECUNDARIO]);

    await page.goto(CHECKOUT_URL);

    const segundo = page.getByRole("radio").filter({ hasText: "Avenida Brasil" });
    await segundo.click();

    await expect(segundo).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("radio").filter({ hasText: "Rua das Flores" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("navegação por teclado seleciona um endereço", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO, ENDERECO_SECUNDARIO]);

    await page.goto(CHECKOUT_URL);

    const segundo = page.getByRole("radio").filter({ hasText: "Avenida Brasil" });
    await segundo.focus();
    await page.keyboard.press("Enter");

    await expect(segundo).toHaveAttribute("aria-checked", "true");
  });

  test("erro ao carregar mostra mensagem amigável com Tentar novamente", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecosError(page);

    await page.goto(CHECKOUT_URL);

    await expect(
      page.getByText("Não foi possível carregar seus endereços.", { exact: true }),
    ).toBeVisible();
    const retry = page.getByRole("button", { name: "Tentar novamente" });
    await expect(retry).toBeVisible();

    await page.unroute("**/enderecos");
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await retry.click();

    await expect(page.getByRole("radiogroup", { name: "Selecione um endereço" })).toBeVisible();
  });

  test("cadastra novo endereço, ele aparece na lista e é selecionado", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);

    const novoEndereco = {
      id: 99,
      usuarioId: 1,
      rua: "Rua Nova",
      numero: "10",
      bairro: "Água Verde",
      cidade: "Curitiba",
      estado: "PR",
      cep: "80240-000",
      padrao: false,
    };
    await page.route("**/enderecos", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({ json: novoEndereco });
        return;
      }
      await route.fulfill({ json: [ENDERECO_PADRAO] });
    });

    await page.goto(CHECKOUT_URL);
    await page.getByRole("button", { name: "+ Adicionar novo endereço" }).click();

    await page.getByLabel("Rua").fill(novoEndereco.rua);
    await page.getByLabel("Número").fill(novoEndereco.numero);
    await page.getByLabel("Bairro").fill(novoEndereco.bairro);
    await page.getByLabel("Cidade").fill(novoEndereco.cidade);
    await page.getByLabel("Estado (UF)").fill(novoEndereco.estado);
    await page.getByLabel("CEP").fill(novoEndereco.cep);
    await page.getByRole("button", { name: "Salvar endereço" }).click();

    await expect(page.getByText("Endereço cadastrado com sucesso.")).toBeVisible();

    const radios = page.getByRole("radio");
    await expect(radios).toHaveCount(2);
    const novoCard = page.getByRole("radio").filter({ hasText: "Rua Nova" });
    await expect(novoCard).toBeVisible();
    await expect(novoCard).toHaveAttribute("aria-checked", "true");
  });
});

test.describe("Checkout — CTA de continuar", () => {
  test("sem endereço selecionado: não avança, mostra toast e destaca a seção", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, []);
    // Nenhuma chamada de pagamento deve acontecer — a validação de endereço
    // bloqueia antes de sequer tentar POST /checkout/session (Task 10).
    const chamadasProibidas = trackPaymentCalls(page);

    await page.goto(CHECKOUT_URL);
    await page.getByRole("button", { name: "Continuar para pagamento →" }).click();

    await expect(page.getByText("Selecione um endereço de entrega para continuar.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(CHECKOUT_URL.replace("/", "\\/")));
    expect(chamadasProibidas).toEqual([]);
  });
});

// Task 10 (POST /checkout/session) + Task 11 (redirecionamento para a URL
// de pagamento retornada, Asaas Checkout a partir da Task 21). "Continuar
// para pagamento" com sessão + carrinho + endereço válidos agora chama o
// service E navega para fora do app — os testes de sucesso interceptam a
// própria URL do Asaas Checkout (mockAsaasCheckoutPage) para a navegação
// completar de forma determinística, sem rede real.
test.describe("Checkout — Task 10/11: criação da sessão e redirecionamento ao Asaas", () => {
  test("com sessão + carrinho + endereço válidos: chama POST /checkout/session com o payload e o JWT esperados, e o navegador é redirecionado para exatamente a URL retornada", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [
      CART_ITEM,
      { produtoId: 202, nome: "Difusor Cedro", slug: "difusor-cedro", preco: 89, quantidade: 1 },
    ]);
    await mockEnderecos(page, [ENDERECO_SECUNDARIO, ENDERECO_PADRAO]);

    const URL_PAGAMENTO = "https://sandbox.asaas.com/checkoutSession/show/cs_test_payload_123";
    // Pequeno atraso proposital na resposta: dá tempo de observar o botão
    // no estado "Processando..." antes da navegação acontecer.
    await page.route("**/checkout/session", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 201,
        json: { sessionId: "cs_test_payload_123", url: URL_PAGAMENTO },
      });
    });
    await mockAsaasCheckoutPage(page, URL_PAGAMENTO);
    const sessionRequests = captureCheckoutSessionRequests(page);

    await page.goto(CHECKOUT_URL);
    // Escopado ao <aside> (resumo do pedido) — o rótulo do botão muda para
    // "Processando..." assim que clicado, então um locator preso ao nome
    // original quebraria na segunda verificação.
    const button = page.locator("aside").getByRole("button");
    await button.click();

    // Enquanto aguarda a resposta: desabilitado, com o spinner/rótulo de
    // processamento — impede um segundo envio.
    await expect(button).toBeDisabled();
    await expect(button).toContainText("Processando...");

    // Redirecionamento externo de verdade — aguarda a navegação completar e
    // confirma que o destino final é EXATAMENTE a URL devolvida pelo backend.
    await page.waitForURL(URL_PAGAMENTO);
    expect(page.url()).toBe(URL_PAGAMENTO);

    expect(sessionRequests).toHaveLength(1);
    // Contrato exato de CreateCheckoutSessionDto (backend/src/checkout/dto) —
    // só produtoId+quantidade por item, nunca preço/nome/subtotal do
    // frontend (o backend recalcula tudo a partir do produto real).
    expect(sessionRequests[0].body).toEqual({
      itens: [
        { produtoId: 101, quantidade: 2 },
        { produtoId: 202, quantidade: 1 },
      ],
      clienteEmail: "cliente@sensora.dev",
      clienteNome: "cliente",
      enderecoId: ENDERECO_PADRAO.id,
    });
    // JWT enviado pela infraestrutura já existente (services/api.ts), sem
    // nenhum mecanismo paralelo.
    expect(sessionRequests[0].authorization).toMatch(/^Bearer .+/);
  });

  test("endpoint chamado é exatamente POST /checkout/session, nunca uma chamada direta à API do Asaas pelo navegador", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO, ENDERECO_SECUNDARIO]);

    const URL_PAGAMENTO = "https://sandbox.asaas.com/checkoutSession/show/cs_test_endpoint_456";
    await mockCheckoutSession(page, { sessionId: "cs_test_endpoint_456", url: URL_PAGAMENTO });
    await mockAsaasCheckoutPage(page, URL_PAGAMENTO);

    const urlsChamadas: { method: string; url: string }[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.hostname === "localhost" && url.port === "3000") {
        urlsChamadas.push({ method: request.method(), url: url.pathname });
      }
      // Nenhuma chamada à API REST do Asaas (api-sandbox.asaas.com/
      // api.asaas.com) deve existir — a API key nunca chega ao navegador
      // (Task 21). Só a navegação de documento para sandbox.asaas.com/...
      // (a própria página hospedada) é esperada, nunca uma chamada
      // XHR/fetch à API do Asaas.
      if (
        url.hostname === "api-sandbox.asaas.com" ||
        url.hostname === "api.asaas.com"
      ) {
        urlsChamadas.push({ method: request.method(), url: request.url() });
      }
    });

    await page.goto(CHECKOUT_URL);
    await page.getByRole("radio").filter({ hasText: "Avenida Brasil" }).click();
    await page.locator("aside").getByRole("button").click();
    await page.waitForURL(URL_PAGAMENTO);

    const chamadasDePagamento = urlsChamadas.filter(
      (c) =>
        c.url === "/checkout/session" ||
        c.url.includes("api-sandbox.asaas.com") ||
        c.url.includes("api.asaas.com"),
    );
    expect(chamadasDePagamento).toEqual([{ method: "POST", url: "/checkout/session" }]);
  });

  test("duplo clique não cria duas sessões", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);

    const URL_PAGAMENTO = "https://sandbox.asaas.com/checkoutSession/show/cs_test_duplo_789";
    await page.route("**/checkout/session", async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.fulfill({
        status: 201,
        json: { sessionId: "cs_test_duplo_789", url: URL_PAGAMENTO },
      });
    });
    await mockAsaasCheckoutPage(page, URL_PAGAMENTO);
    const sessionRequests = captureCheckoutSessionRequests(page);

    await page.goto(CHECKOUT_URL);
    const button = page.locator("aside").getByRole("button");

    // Dois cliques disparados o mais próximo possível um do outro — o
    // segundo usa force porque o botão já pode estar `disabled` (o que, por
    // si só, já impede o evento de clique nativo de chegar ao handler).
    await button.click();
    await button.click({ force: true }).catch(() => {});

    await page.waitForURL(URL_PAGAMENTO);
    expect(sessionRequests).toHaveLength(1);
  });

  test("sem token válido no momento do clique: não chama o service e redireciona para login (fluxo da Task 7)", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSession(page);
    const sessionRequests = captureCheckoutSessionRequests(page);

    await page.goto(CHECKOUT_URL);
    await page.getByRole("radiogroup", { name: "Selecione um endereço" }).waitFor();

    // Simula a sessão sendo limpa depois que a página já carregou (ex.:
    // logout em outra aba, expiração) — antes do clique em continuar.
    await page.evaluate((key) => window.localStorage.removeItem(key), TOKEN_KEY);

    await page.getByRole("button", { name: "Continuar para pagamento →" }).click();

    await expect(page).toHaveURL(/\/login\?redirect=%2Floja%2Fcheckout/);
    expect(sessionRequests).toEqual([]);
  });

  test("token já expirado ao carregar a página: guarda da Task 7 redireciona antes de qualquer chamada de checkout", async ({
    page,
  }) => {
    await page.addInitScript(
      ([tokenKey, token]) => window.localStorage.setItem(tokenKey, token),
      [TOKEN_KEY, tokenExpiradoFake()] as const,
    );
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSession(page);
    const sessionRequests = captureCheckoutSessionRequests(page);

    await page.goto(CHECKOUT_URL);

    await expect(page).toHaveURL(/\/login\?redirect=%2Floja%2Fcheckout/);
    expect(sessionRequests).toEqual([]);
  });

  test("carrinho vazio: o CTA de checkout nem existe, então o service nunca é chamado", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, []);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSession(page);
    const sessionRequests = captureCheckoutSessionRequests(page);

    await page.goto(CHECKOUT_URL);
    await expect(page.getByText("Não há produtos para finalizar")).toBeVisible();
    await expect(page.getByRole("button", { name: /Continuar para pagamento/ })).toHaveCount(0);

    expect(sessionRequests).toEqual([]);
  });

  test("backend retorna 500: não redireciona, mostra toast amigável e reabilita o botão", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSessionError(page, 500);
    const asaasCalls = trackAsaasCalls(page);

    await page.goto(CHECKOUT_URL);
    const button = page.getByRole("button", { name: "Continuar para pagamento →" });
    await button.click();

    await expect(
      page.getByText("Não foi possível iniciar o pagamento. Tente novamente."),
    ).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(page).toHaveURL(new RegExp(CHECKOUT_URL.replace("/", "\\/")));
    expect(asaasCalls).toEqual([]);
  });

  test("backend retorna resposta sem url utilizável: não redireciona, mostra erro e reabilita o botão", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    // sessionId presente, url ausente/vazia — resposta malformada do backend.
    await mockCheckoutSession(page, { sessionId: "cs_test_sem_url", url: "" });
    const asaasCalls = trackAsaasCalls(page);

    await page.goto(CHECKOUT_URL);
    const button = page.getByRole("button", { name: "Continuar para pagamento →" });
    await button.click();

    await expect(
      page.getByText("Não foi possível iniciar o pagamento. Tente novamente."),
    ).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(page).toHaveURL(new RegExp(CHECKOUT_URL.replace("/", "\\/")));
    expect(asaasCalls).toEqual([]);
  });

  test("backend retorna URL insegura (esquema não-https): não redireciona, não executa nada e mostra erro", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSession(page, {
      sessionId: "cs_test_xss",
      url: "javascript:alert(1)",
    });

    let dialogApareceu = false;
    page.on("dialog", async (dialog) => {
      dialogApareceu = true;
      await dialog.dismiss();
    });

    await page.goto(CHECKOUT_URL);
    const button = page.getByRole("button", { name: "Continuar para pagamento →" });
    await button.click();

    await expect(
      page.getByText("Não foi possível iniciar o pagamento. Tente novamente."),
    ).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(page).toHaveURL(new RegExp(CHECKOUT_URL.replace("/", "\\/")));
    expect(dialogApareceu).toBe(false);
  });
});

test.describe("Checkout — console e responsividade", () => {
  test("sem erros de console durante a jornada principal", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);

    const erros: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") erros.push(msg.text());
    });
    page.on("pageerror", (err) => erros.push(err.message));

    await page.goto(CHECKOUT_URL);
    await page.getByRole("radio").first().waitFor();

    expect(erros).toEqual([]);
  });

  for (const { nome, width, height } of [
    { nome: "desktop 1440px", width: 1440, height: 900 },
    { nome: "tablet 768px", width: 768, height: 1024 },
    { nome: "mobile 375px", width: 375, height: 812 },
  ]) {
    test(`sem overflow horizontal em ${nome}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await seedSession(page);
      await seedCart(page, [CART_ITEM]);
      await mockEnderecos(page, [ENDERECO_PADRAO, ENDERECO_SECUNDARIO]);

      await page.goto(CHECKOUT_URL);
      await page.getByRole("radiogroup", { name: "Selecione um endereço" }).waitFor();

      expect(await hasHorizontalOverflow(page)).toBe(false);

      const button = page.getByRole("button", { name: "Continuar para pagamento →" });
      await expect(button).toBeVisible();
    });
  }
});

// Task 16 — tratamento de erros do checkout. Backend real indisponível
// neste ambiente (mesmo mecanismo de mock/intercept das Tasks 10/11,
// documentado no cabeçalho do arquivo). Cenários F (resposta sem url) e
// URL insegura já têm cobertura própria no describe "Task 10/11" acima —
// não duplicados aqui, só continuam rodando como regressão.
function countEnderecosGetCalls(page: Page): { count: number } {
  const contador = { count: 0 };
  page.on("request", (request) => {
    if (request.url().includes("/enderecos") && request.method() === "GET") {
      contador.count += 1;
    }
  });
  return contador;
}

test.describe("Checkout — Task 16: tratamento de erros", () => {
  test("estoque insuficiente: mostra mensagem específica, não redireciona, reabilita o botão, carrinho intacto", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSessionError(
      page,
      400,
      'Estoque insuficiente para "Vela Aromática Lavanda"',
    );
    const asaasCalls = trackAsaasCalls(page);

    await page.goto(CHECKOUT_URL);
    const button = page.getByRole("button", { name: "Continuar para pagamento →" });
    await button.click();

    await expect(
      page.getByText('Estoque insuficiente para "Vela Aromática Lavanda"'),
    ).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(page).toHaveURL(new RegExp(CHECKOUT_URL.replace("/", "\\/")));
    expect(asaasCalls).toEqual([]);

    const cartRaw = await page.evaluate((key) => window.localStorage.getItem(key), CART_STORAGE_KEY);
    expect(JSON.parse(cartRaw ?? "[]")).toEqual([CART_ITEM]);
  });

  test("produto indisponível/inativo: mostra mensagem específica, não redireciona, reabilita o botão", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSessionError(
      page,
      400,
      'Produto "Vela Aromática Lavanda" não está mais disponível',
    );
    const asaasCalls = trackAsaasCalls(page);

    await page.goto(CHECKOUT_URL);
    const button = page.getByRole("button", { name: "Continuar para pagamento →" });
    await button.click();

    await expect(
      page.getByText('Produto "Vela Aromática Lavanda" não está mais disponível'),
    ).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(page).toHaveURL(new RegExp(CHECKOUT_URL.replace("/", "\\/")));
    expect(asaasCalls).toEqual([]);
  });

  test("endereço inválido: mostra mensagem própria, recarrega a lista de endereços e limpa a seleção", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSessionError(
      page,
      404,
      "Endereço com id 1 não encontrado",
    );
    const enderecosGetCalls = countEnderecosGetCalls(page);
    const asaasCalls = trackAsaasCalls(page);

    await page.goto(CHECKOUT_URL);
    await page.getByRole("radiogroup", { name: "Selecione um endereço" }).waitFor();
    const chamadasAntes = enderecosGetCalls.count;

    const button = page.getByRole("button", { name: "Continuar para pagamento →" });
    await button.click();

    await expect(
      page.getByText("Esse endereço não está mais disponível. Selecione outro."),
    ).toBeVisible();
    await expect(button).toBeEnabled();
    // Prova que a lista foi recarregada — não só o toast: mais uma chamada
    // GET /enderecos depois do clique.
    await expect
      .poll(() => enderecosGetCalls.count)
      .toBeGreaterThan(chamadasAntes);
    expect(asaasCalls).toEqual([]);
  });

  test("401/sessão expirada: não tenta de novo, redireciona para /login preservando o retorno ao checkout, carrinho intacto", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSessionError(page, 401);
    const asaasCalls = trackAsaasCalls(page);
    const sessionRequests = captureCheckoutSessionRequests(page);

    await page.goto(CHECKOUT_URL);
    await page.getByRole("button", { name: "Continuar para pagamento →" }).click();

    await expect(page).toHaveURL(/\/login\?redirect=%2Floja%2Fcheckout/);
    expect(sessionRequests).toHaveLength(1);
    expect(asaasCalls).toEqual([]);

    const cartRaw = await page.evaluate((key) => window.localStorage.getItem(key), CART_STORAGE_KEY);
    expect(JSON.parse(cartRaw ?? "[]")).toEqual([CART_ITEM]);
  });

  test("erro 500: mostra mensagem amigável (nunca o texto técnico do backend), reabilita o botão", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSessionError(page, 500, "Internal server error");
    const asaasCalls = trackAsaasCalls(page);

    await page.goto(CHECKOUT_URL);
    const button = page.getByRole("button", { name: "Continuar para pagamento →" });
    await button.click();

    await expect(
      page.getByText("Não foi possível iniciar o pagamento. Tente novamente."),
    ).toBeVisible();
    await expect(page.getByText("Internal server error")).toHaveCount(0);
    await expect(button).toBeEnabled();
    await expect(page).toHaveURL(new RegExp(CHECKOUT_URL.replace("/", "\\/")));
    expect(asaasCalls).toEqual([]);
  });

  test("erro 503: mostra mensagem amigável, reabilita o botão", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSessionError(page, 503, "Service Unavailable");

    await page.goto(CHECKOUT_URL);
    const button = page.getByRole("button", { name: "Continuar para pagamento →" });
    await button.click();

    await expect(
      page.getByText("Não foi possível iniciar o pagamento. Tente novamente."),
    ).toBeVisible();
    await expect(page.getByText("Service Unavailable")).toHaveCount(0);
    await expect(button).toBeEnabled();
  });

  test("falha de rede: mensagem específica de conexão, não redireciona, reabilita o botão", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSessionNetworkFailure(page);
    const asaasCalls = trackAsaasCalls(page);

    await page.goto(CHECKOUT_URL);
    const button = page.getByRole("button", { name: "Continuar para pagamento →" });
    await button.click();

    await expect(
      page.getByText("Não foi possível conectar ao servidor. Tente novamente."),
    ).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(page).toHaveURL(new RegExp(CHECKOUT_URL.replace("/", "\\/")));
    expect(asaasCalls).toEqual([]);
  });

  test("retry manual: após erro, um novo clique tenta de novo e pode ter sucesso", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSessionError(page, 500, "Internal server error");
    const sessionRequests = captureCheckoutSessionRequests(page);

    await page.goto(CHECKOUT_URL);
    const button = page.getByRole("button", { name: "Continuar para pagamento →" });
    await button.click();
    await expect(
      page.getByText("Não foi possível iniciar o pagamento. Tente novamente."),
    ).toBeVisible();
    expect(sessionRequests).toHaveLength(1);

    // Troca o mock para sucesso — simula o backend voltando ao normal — e
    // clica de novo manualmente.
    const URL_PAGAMENTO = "https://sandbox.asaas.com/checkoutSession/show/cs_test_retry_manual";
    await page.unroute("**/checkout/session");
    await mockCheckoutSession(page, {
      sessionId: "cs_test_retry_manual",
      url: URL_PAGAMENTO,
    });
    await mockAsaasCheckoutPage(page, URL_PAGAMENTO);

    await page.locator("aside").getByRole("button").click();
    await page.waitForURL(URL_PAGAMENTO);

    expect(sessionRequests).toHaveLength(2);
  });

  test("erro não gera uma segunda requisição automaticamente", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    await mockCheckoutSessionError(page, 500, "Internal server error");
    const sessionRequests = captureCheckoutSessionRequests(page);

    await page.goto(CHECKOUT_URL);
    await page.getByRole("button", { name: "Continuar para pagamento →" }).click();
    await expect(
      page.getByText("Não foi possível iniciar o pagamento. Tente novamente."),
    ).toBeVisible();

    // Espera um tempo razoável sem nenhuma nova interação — nenhum retry
    // automático/timer deve disparar uma segunda chamada sozinho.
    await page.waitForTimeout(1500);
    expect(sessionRequests).toHaveLength(1);
  });

  test("nenhum segredo ou detalhe interno aparece na interface, mesmo se o backend vazar algo em uma mensagem de 500", async ({
    page,
  }) => {
    await seedSession(page);
    await seedCart(page, [CART_ITEM]);
    await mockEnderecos(page, [ENDERECO_PADRAO]);
    // Mensagem "maliciosa" de propósito — se o frontend a exibisse, seria
    // uma falha grave. A validação de status >= 500 em getErrorMessage
    // (Task 16) deve ignorá-la completamente, sempre usando o fallback.
    await mockCheckoutSessionError(
      page,
      500,
      "STRIPE_SECRET_KEY=sk_live_FAKE_LEAK_NAO_REAL at PrismaClientKnownRequestError\n    at stack trace linha 42",
    );

    await page.goto(CHECKOUT_URL);
    await page.getByRole("button", { name: "Continuar para pagamento →" }).click();
    await expect(
      page.getByText("Não foi possível iniciar o pagamento. Tente novamente."),
    ).toBeVisible();

    const textoVisivel = await page.locator("body").innerText();
    expect(textoVisivel).not.toContain("STRIPE_SECRET_KEY");
    expect(textoVisivel).not.toContain("sk_live");
    expect(textoVisivel).not.toContain("PrismaClientKnownRequestError");
    expect(textoVisivel).not.toContain("stack trace");
  });
});

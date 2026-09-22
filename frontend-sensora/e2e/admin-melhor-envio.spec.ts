import { test, expect, type Page } from "@playwright/test";

// Etapa 6.5 (Painel administrativo) + Central de Integrações (Admin) —
// suíte E2E do card de integração "Melhor Envio", movido do Dashboard
// (/workspace-x) para /workspace-x/integracoes (ADMIN-only, Etapa 8.12 —
// antes /admin e /admin/integracoes) nesta última tarefa. Mesmo
// padrão de mocks do resto do projeto (ver e2e/checkout.spec.ts): backend
// real indisponível neste ambiente de teste, toda chamada de API é
// interceptada via page.route com respostas controladas. Não testa o
// handshake OAuth em si (isso já foi validado manualmente contra o Sandbox
// real, ver relatório da etapa) — só o comportamento da UI: status exibido,
// botão de conectar, header de autenticação enviado, e o redirecionamento
// para a URL que o backend devolve.
//
// A página agora também renderiza os cards de Asaas/Resend/ImageKit (ver
// e2e/admin-integracoes.spec.ts para a suíte deles e para os testes de
// guarda ADMIN-only/sidebar) — mockStatusDemaisIntegracoes abaixo evita que
// eles fiquem batendo em rede real (não mockada) enquanto estes testes
// verificam só o card do Melhor Envio.

const INTEGRACOES_URL = "/workspace-x/integracoes";
const TOKEN_KEY = "sensora_token";

function base64Url(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fakeToken(perfil: "ADMIN" | "VENDEDOR" | "CLIENTE", sub = 31): string {
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

async function mockStatusDemaisIntegracoes(page: Page) {
  await page.route("**/admin/asaas/status", async (route) => {
    await route.fulfill({ json: { configured: true, baseUrl: "https://api.asaas.com/v3" } });
  });
  await page.route("**/admin/mail/status", async (route) => {
    await route.fulfill({ json: { configured: true } });
  });
  await page.route("**/imagekit/status", async (route) => {
    await route.fulfill({ json: { configured: true } });
  });
}

async function mockStatus(
  page: Page,
  conectado: boolean,
  opts?: { status?: number; configured?: boolean },
) {
  await page.route("**/admin/melhor-envio/status", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    if (opts?.status && opts.status >= 400) {
      await route.fulfill({ status: opts.status, body: "" });
      return;
    }
    await route.fulfill({
      json: {
        // `configured` (credenciais OAuth2 presentes) e `conectado` (token
        // salvo) são conceitos diferentes desde a vistoria de Integrações —
        // default true aqui porque a maioria destes testes já assumia
        // credenciais configuradas (só variando se o token existe ou não).
        configured: opts?.configured ?? true,
        conectado,
        ambiente: "sandbox",
        expiresAt: conectado ? new Date(Date.now() + 3600_000).toISOString() : null,
      },
    });
  });
}

async function mockVerificar(
  page: Page,
  resposta: { operational: boolean; mensagem?: string },
) {
  await page.route("**/admin/melhor-envio/verificar", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: resposta });
      return;
    }
    await route.continue();
  });
}

// Vistoria das Integrações — Asaas e ImageKit agora também têm um botão
// "Verificar agora" (IntegracaoStatusCard.tsx), então o rótulo deixou de
// ser exclusivo do card do Melhor Envio nesta página. Escopa pela heading
// do próprio card (h3 "Melhor Envio") subindo para o container que
// também contém o botão — mesma estrutura em MelhorEnvioIntegracaoCard.tsx
// e IntegracaoStatusCard.tsx (header row -> card root -> resto do card).
function cardMelhorEnvio(page: Page) {
  return page.getByRole("heading", { name: "Melhor Envio", exact: true }).locator("../..");
}

function capturarChamadasConectar(page: Page) {
  const chamadas: { authorization: string | undefined }[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/admin/melhor-envio/conectar") && request.method() === "GET") {
      chamadas.push({ authorization: request.headers()["authorization"] });
    }
  });
  return chamadas;
}

const URL_AUTORIZACAO =
  "https://sandbox.melhorenvio.com.br/oauth/authorize?client_id=teste&redirect_uri=https%3A%2F%2Fsensora-loja-landing.onrender.com%2Fadmin%2Fmelhor-envio%2Fcallback&response_type=code&scope=shipping-calculate&state=abc123";

async function mockConectar(page: Page, url: string = URL_AUTORIZACAO) {
  await page.route("**/admin/melhor-envio/conectar", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { url } });
      return;
    }
    await route.continue();
  });
}

// Mesmo raciocínio de mockAsaasCheckoutPage em e2e/checkout.spec.ts: sem
// interceptar a própria URL de destino, o Playwright tentaria navegar de
// verdade para o Melhor Envio (rede real, indisponível/não-determinística
// neste ambiente).
async function mockPaginaAutorizacao(page: Page, url: string) {
  await page.route(url, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>Melhor Envio OAuth (mock de teste)</body></html>",
    });
  });
}

test.describe("Admin — integração Melhor Envio (Etapa 6.5 + Central de Integrações)", () => {
  test("A: status desconectado mostra 'Não conectado' e o botão Conectar Melhor Envio", async ({
    page,
  }) => {
    await seedSession(page, "ADMIN");
    await mockStatusDemaisIntegracoes(page);
    await mockStatus(page, false);
    await mockConectar(page);

    await page.goto(INTEGRACOES_URL);

    await expect(page.getByText("Não conectado", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Conectar Melhor Envio" })).toBeVisible();
    await expect(cardMelhorEnvio(page).getByRole("button", { name: "Verificar agora" })).toHaveCount(0);
  });

  test("B/C/D: clicar em Conectar chama /conectar com o Bearer do interceptor e redireciona para a URL do Melhor Envio", async ({
    page,
  }) => {
    await seedSession(page, "ADMIN");
    await mockStatusDemaisIntegracoes(page);
    await mockStatus(page, false);
    // Pequeno atraso proposital (mesmo padrão de checkout.spec.ts): dá tempo
    // de observar o botão desabilitado/"Conectando..." antes da navegação.
    await page.route("**/admin/melhor-envio/conectar", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({ json: { url: URL_AUTORIZACAO } });
    });
    await mockPaginaAutorizacao(page, URL_AUTORIZACAO);
    const chamadasConectar = capturarChamadasConectar(page);

    await page.goto(INTEGRACOES_URL);
    // O rótulo do botão muda para "Conectando..." assim que clicado (mesmo
    // padrão de checkout.spec.ts) — um locator preso só ao nome original
    // deixaria de casar com o elemento na verificação seguinte.
    const botao = page.getByRole("button", { name: /Conectar Melhor Envio|Conectando/ });
    await botao.click();

    await expect(botao).toBeDisabled();
    await expect(botao).toContainText("Conectando...");

    await page.waitForURL(URL_AUTORIZACAO);
    expect(page.url()).toBe(URL_AUTORIZACAO);

    expect(chamadasConectar).toHaveLength(1);
    // O interceptor de services/api.ts (Authorization: Bearer <token>) é
    // quem autentica a chamada — nenhum mecanismo paralelo foi criado.
    expect(chamadasConectar[0].authorization).toMatch(/^Bearer .+/);
  });

  // Antes desta tarefa, este cenário era testado com VENDEDOR (o card vivia
  // no Dashboard, acessível a todo STAFF). A página /workspace-x/integracoes
  // (Etapa 8.12, antes /admin/integracoes) agora é ADMIN-only (ver
  // e2e/admin-integracoes.spec.ts), então o mesmo
  // comportamento do card (status conectado + "Verificar agora") passa a
  // ser verificado com ADMIN — o endpoint em si
  // (GET /admin/melhor-envio/status) continua STAFF_ROLES, intocado.
  //
  // Vistoria das Integrações — "Verificar conexão" virou "Verificar agora"
  // e passou a chamar GET /admin/melhor-envio/verificar (verificação real
  // via GET /api/v2/me no backend), nunca mais só reconsultando /status.
  test("E: status conectado mostra 'Conectado'; Verificar agora chama /verificar (não /status de novo) e reflete o resultado", async ({
    page,
  }) => {
    await seedSession(page, "ADMIN");
    await mockStatusDemaisIntegracoes(page);
    await mockStatus(page, true);

    let chamadasVerificar = 0;
    await page.route("**/admin/melhor-envio/verificar", async (route) => {
      chamadasVerificar += 1;
      await route.fulfill({ json: { operational: true } });
    });

    await page.goto(INTEGRACOES_URL);

    await expect(page.getByText("Conectado", { exact: true })).toBeVisible();
    const botaoVerificar = cardMelhorEnvio(page).getByRole("button", { name: "Verificar agora" });
    await expect(botaoVerificar).toBeVisible();
    await expect(page.getByRole("button", { name: "Conectar Melhor Envio" })).toHaveCount(0);

    await botaoVerificar.click();

    await expect.poll(() => chamadasVerificar).toBeGreaterThan(0);
    // Verificação real bem-sucedida: o badge sobe de "Conectado" (nunca
    // verificado) para "Operacional".
    await expect(page.getByText("Operacional", { exact: true })).toBeVisible();
  });

  test("E2: Verificar agora com falha na verificação mostra 'Instável' e a mensagem segura do backend", async ({
    page,
  }) => {
    await seedSession(page, "ADMIN");
    await mockStatusDemaisIntegracoes(page);
    await mockStatus(page, true);
    await mockVerificar(page, {
      operational: false,
      mensagem: "O Melhor Envio recusou a verificação da conexão.",
    });

    await page.goto(INTEGRACOES_URL);
    await cardMelhorEnvio(page).getByRole("button", { name: "Verificar agora" }).click();

    await expect(page.getByText("Instável", { exact: true })).toBeVisible();
    await expect(
      page.getByText("O Melhor Envio recusou a verificação da conexão."),
    ).toBeVisible();
  });

  test("F: usuário CLIENTE não acessa /workspace-x/integracoes (e portanto nunca vê a integração)", async ({
    page,
  }) => {
    await seedSession(page, "CLIENTE");
    const chamadasStatus: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/admin/melhor-envio/")) chamadasStatus.push(request.url());
    });

    await page.goto(INTEGRACOES_URL);

    await expect(page).toHaveURL("/loja");
    await expect(page.getByText("Melhor Envio")).toHaveCount(0);
    expect(chamadasStatus).toEqual([]);
  });

  test("erro ao verificar status: mostra mensagem com Tentar novamente, sem quebrar a página", async ({
    page,
  }) => {
    await seedSession(page, "ADMIN");
    await mockStatusDemaisIntegracoes(page);
    await mockStatus(page, false, { status: 500 });

    await page.goto(INTEGRACOES_URL);

    await expect(page.getByText("Não foi possível verificar a conexão.")).toBeVisible();
    const retry = page.getByRole("button", { name: "Tentar novamente" });
    await expect(retry).toBeVisible();

    await page.unroute("**/admin/melhor-envio/status");
    await mockStatus(page, false);
    await retry.click();

    await expect(page.getByText("Não conectado", { exact: true })).toBeVisible();
  });
});

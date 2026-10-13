import { test, expect, type Page } from "@playwright/test";

// Formulário de suporte do cliente (/conta/suporte, POST /suporte). A API é
// simulada via page.route pelo CAMINHO da URL (o host da API vem do .env do
// app, que o Playwright não lê; "**/suporte" também pegaria a própria
// página /conta/suporte). Tudo que não for o servidor local é bloqueado:
// nenhum teste daqui pode alcançar uma API real.

const TOKEN_KEY = "sensora_token";
const SUPORTE_URL = "/conta/suporte";

test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.hostname !== "localhost",
    (route) => route.abort(),
  );
});

function base64Url(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fakeToken(perfil: "CLIENTE" | "ADMIN" = "CLIENTE"): string {
  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const payload = base64Url({
    sub: 1,
    email: "cliente@sensora.dev",
    perfil,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.assinatura-fake`;
}

async function seedSession(page: Page, perfil: "CLIENTE" | "ADMIN" = "CLIENTE") {
  await page.addInitScript(
    ([tokenKey, token]) => {
      window.localStorage.setItem(tokenKey, token);
    },
    [TOKEN_KEY, fakeToken(perfil)] as const,
  );
}

// A API fica em outra origem: a resposta simulada precisa liberar o CORS.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

// POST /suporte com o corpo de cada envio registrado. `resposta` permite
// simular erro e atraso.
async function mockSuporte(
  page: Page,
  resposta: { status?: number; body?: unknown; delayMs?: number } = {},
): Promise<{ corpos: unknown[] }> {
  const chamadas = { corpos: [] as unknown[] };
  await page.route(
    (url) => url.pathname === "/suporte",
    async (route) => {
      const metodo = route.request().method();
      if (metodo === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS });
        return;
      }
      if (metodo !== "POST") {
        await route.fallback();
        return;
      }
      chamadas.corpos.push(route.request().postDataJSON());
      if (resposta.delayMs) {
        await new Promise((resolve) => setTimeout(resolve, resposta.delayMs));
      }
      await route.fulfill({
        status: resposta.status ?? 201,
        headers: CORS,
        json: resposta.body ?? {
          id: 12,
          assunto: "Pedido atrasado",
          status: "ABERTA",
          criadaEm: "2026-10-13T15:00:00.000Z",
        },
      });
    },
  );
  return chamadas;
}

test.describe("Minha Conta — Suporte", () => {
  test("cliente envia assunto e mensagem e vê a confirmação", async ({ page }) => {
    await seedSession(page);
    const chamadas = await mockSuporte(page);

    await page.goto(SUPORTE_URL);
    await page.getByLabel("Assunto").fill("Pedido atrasado");
    await page.getByLabel("Mensagem").fill("Meu pedido PED-10 ainda não chegou.\nPodem verificar?");
    await page.getByRole("button", { name: "Enviar solicitação" }).click();

    await expect(page.getByText("Recebemos sua solicitação nº 12.")).toBeVisible();
    await expect(page.getByText("cliente@sensora.dev")).toBeVisible();
    // Só assunto e mensagem saem daqui — nunca nome, e-mail ou usuário.
    expect(chamadas.corpos).toEqual([
      {
        assunto: "Pedido atrasado",
        mensagem: "Meu pedido PED-10 ainda não chegou.\nPodem verificar?",
      },
    ]);

    await page.getByRole("button", { name: "Enviar outra solicitação" }).click();
    await expect(page.getByLabel("Assunto")).toHaveValue("");
  });

  test("campos vazios ou só com espaços mostram o erro e não chamam a API", async ({ page }) => {
    await seedSession(page);
    const chamadas = await mockSuporte(page);

    await page.goto(SUPORTE_URL);
    await page.getByRole("button", { name: "Enviar solicitação" }).click();
    await expect(page.getByText("Informe o assunto")).toBeVisible();
    await expect(page.getByText("Escreva a mensagem")).toBeVisible();

    await page.getByLabel("Assunto").fill("   ");
    await page.getByLabel("Mensagem").fill("Texto");
    await page.getByRole("button", { name: "Enviar solicitação" }).click();
    await expect(page.getByText("Informe o assunto")).toBeVisible();

    expect(chamadas.corpos).toHaveLength(0);
  });

  test("os campos respeitam os limites do backend (150 / 5000)", async ({ page }) => {
    await seedSession(page);
    await mockSuporte(page);

    await page.goto(SUPORTE_URL);

    await expect(page.getByLabel("Assunto")).toHaveAttribute("maxlength", "150");
    await expect(page.getByLabel("Mensagem")).toHaveAttribute("maxlength", "5000");
    await page.getByLabel("Mensagem").fill("abc");
    await expect(page.getByText("3/5000")).toBeVisible();
  });

  test("erro do backend aparece na tela e o formulário continua preenchido", async ({ page }) => {
    await seedSession(page);
    await mockSuporte(page, { status: 400, body: { message: "Escreva a mensagem." } });

    await page.goto(SUPORTE_URL);
    await page.getByLabel("Assunto").fill("Dúvida");
    await page.getByLabel("Mensagem").fill("Texto");
    await page.getByRole("button", { name: "Enviar solicitação" }).click();

    await expect(page.getByText("Escreva a mensagem.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Assunto")).toHaveValue("Dúvida");
  });

  test("429 (limite de envios) mostra uma mensagem clara", async ({ page }) => {
    await seedSession(page);
    await mockSuporte(page, {
      status: 429,
      body: { message: "ThrottlerException: Too Many Requests" },
    });

    await page.goto(SUPORTE_URL);
    await page.getByLabel("Assunto").fill("Dúvida");
    await page.getByLabel("Mensagem").fill("Texto");
    await page.getByRole("button", { name: "Enviar solicitação" }).click();

    await expect(
      page.getByText("Você enviou várias solicitações em pouco tempo", { exact: false }),
    ).toBeVisible();
  });

  test("durante o envio o botão fica desabilitado: clique repetido não envia duas vezes", async ({
    page,
  }) => {
    await seedSession(page);
    const chamadas = await mockSuporte(page, { delayMs: 800 });

    await page.goto(SUPORTE_URL);
    await page.getByLabel("Assunto").fill("Dúvida");
    await page.getByLabel("Mensagem").fill("Texto");
    const botao = page.getByRole("button", { name: "Enviar solicitação" });
    await botao.click();

    const enviando = page.getByRole("button", { name: "Enviando..." });
    await expect(enviando).toBeDisabled();
    await enviando.click({ force: true });

    await expect(page.getByText("Recebemos sua solicitação nº 12.")).toBeVisible();
    expect(chamadas.corpos).toHaveLength(1);
  });

  test("visitante é levado ao login e volta para o suporte", async ({ page }) => {
    const chamadas = await mockSuporte(page);

    await page.goto(SUPORTE_URL);

    await expect(page).toHaveURL(/\/login\?redirect=%2Fconta%2Fsuporte$/);
    expect(chamadas.corpos).toHaveLength(0);
  });

  test("conta de staff vê o aviso e não o formulário", async ({ page }) => {
    await seedSession(page, "ADMIN");
    await mockSuporte(page);

    await page.goto(SUPORTE_URL);

    await expect(page.getByText("O formulário de suporte é para contas de cliente.")).toBeVisible();
    await expect(page.getByLabel("Assunto")).toHaveCount(0);
  });

  test("Minha Conta tem o atalho para o suporte", async ({ page }) => {
    await seedSession(page);

    await page.goto("/conta");
    await page.getByRole("link", { name: /Suporte/ }).first().click();

    await expect(page).toHaveURL(/\/conta\/suporte$/);
    await expect(page.getByRole("heading", { name: "Suporte" })).toBeVisible();
  });
});

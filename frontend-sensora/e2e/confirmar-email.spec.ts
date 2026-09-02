import { test, expect, type Page } from "@playwright/test";

// Etapa 6.4 (Confirmação de e-mail) — suíte E2E de /confirmar-email. Sem
// backend real disponível neste ambiente: POST /auth/verify-email e
// POST /auth/resend-verification são interceptados via page.route com
// respostas controladas, mesmo padrão de e2e/checkout.spec.ts. O ponto mais
// importante desta suíte é a regra de segurança aprovada: a confirmação
// NUNCA deve disparar sozinha ao carregar a página — só quando o usuário
// clica manualmente no botão (mitiga scanners de e-mail corporativos que
// "abrem" links automaticamente e queimariam o token de uso único antes do
// usuário real ver o e-mail).

const CONFIRM_URL = "/confirmar-email";

function trackVerifyEmailCalls(page: Page) {
  const chamadas: unknown[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/auth/verify-email") && request.method() === "POST") {
      chamadas.push(request.postDataJSON());
    }
  });
  return chamadas;
}

async function mockVerifyEmail(
  page: Page,
  status: number,
  body: { message: string },
) {
  await page.route("**/auth/verify-email", async (route) => {
    await route.fulfill({ status, json: body });
  });
}

async function mockResendVerification(page: Page, message: string) {
  await page.route("**/auth/resend-verification", async (route) => {
    await route.fulfill({ status: 200, json: { message } });
  });
}

test.describe("Confirmar e-mail — sem token na URL", () => {
  test("mostra 'link inválido' e o formulário de reenvio, sem tentar confirmar nada", async ({
    page,
  }) => {
    const chamadas = trackVerifyEmailCalls(page);

    await page.goto(CONFIRM_URL);

    await expect(page.getByRole("heading", { name: "Link inválido" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reenviar e-mail de confirmação" }),
    ).toBeVisible();
    expect(chamadas).toHaveLength(0);
  });
});

test.describe("Confirmar e-mail — com token (não dispara sozinho)", () => {
  test("carregar a página com ?token= NÃO chama verify-email automaticamente — só depois do clique manual", async ({
    page,
  }) => {
    const chamadas = trackVerifyEmailCalls(page);
    await mockVerifyEmail(page, 200, { message: "E-mail confirmado com sucesso." });

    await page.goto(`${CONFIRM_URL}?token=abc123`);
    await expect(
      page.getByRole("heading", { name: "Confirme seu e-mail" }),
    ).toBeVisible();

    // Aguarda um instante para provar que nada dispara sozinho — a regra de
    // segurança aprovada é justamente essa: exige clique manual.
    await page.waitForTimeout(500);
    expect(chamadas).toHaveLength(0);

    await page.getByRole("button", { name: "Confirmar meu e-mail" }).click();

    await expect(page.getByRole("heading", { name: "E-mail confirmado" })).toBeVisible();
    await expect(page.getByText("E-mail confirmado com sucesso.")).toBeVisible();
    expect(chamadas).toEqual([{ token: "abc123" }]);
  });

  test("token inválido/expirado: mostra erro amigável com opção de reenviar", async ({
    page,
  }) => {
    await mockVerifyEmail(page, 401, { message: "Token inválido ou expirado" });

    await page.goto(`${CONFIRM_URL}?token=expirado`);
    await page.getByRole("button", { name: "Confirmar meu e-mail" }).click();

    await expect(
      page.getByRole("heading", { name: "Não foi possível confirmar" }),
    ).toBeVisible();
    await expect(page.getByText("Token inválido ou expirado")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reenviar e-mail de confirmação" }),
    ).toBeVisible();
  });

  test("reenvio a partir da tela de erro chama resend-verification com o e-mail digitado e mostra confirmação genérica", async ({
    page,
  }) => {
    await mockVerifyEmail(page, 401, { message: "Token inválido ou expirado" });
    let resendBody: unknown = null;
    await page.route("**/auth/resend-verification", async (route) => {
      resendBody = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        json: { message: "Se existir uma conta com esse e-mail ainda não confirmada, você receberá um novo link de confirmação." },
      });
    });

    await page.goto(`${CONFIRM_URL}?token=expirado`);
    await page.getByRole("button", { name: "Confirmar meu e-mail" }).click();
    await expect(
      page.getByRole("heading", { name: "Não foi possível confirmar" }),
    ).toBeVisible();

    await page.getByLabel("Email").fill("cliente@sensora.dev");
    await page.getByRole("button", { name: "Reenviar e-mail de confirmação" }).click();

    await expect(page.getByText(/receberá um novo link em instantes/)).toBeVisible();
    expect(resendBody).toEqual({ email: "cliente@sensora.dev" });
  });
});

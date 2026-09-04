import { test, expect, type Page } from "@playwright/test";

// Etapa 8.0 (Finalização do e-mail/Resend) — suíte E2E de /forgot-password
// e /reset-password. Não existia nenhuma página nem suíte para este fluxo
// antes desta etapa (achado da auditoria: o link "Esqueci minha senha" do
// login e o e-mail de redefinição enviado pelo backend apontavam para
// páginas que não existiam). Sem backend real disponível neste ambiente:
// POST /auth/forgot-password e POST /auth/reset-password são interceptados
// via page.route com respostas controladas, mesmo padrão de
// e2e/confirmar-email.spec.ts.

function mockForgotPassword(page: Page, status: number, body: { message: string }) {
  return page.route("**/auth/forgot-password", async (route) => {
    await route.fulfill({ status, json: body });
  });
}

function mockResetPassword(page: Page, status: number, body: { message: string }) {
  return page.route("**/auth/reset-password", async (route) => {
    await route.fulfill({ status, json: body });
  });
}

test.describe("Esqueci minha senha — /forgot-password", () => {
  test("envia o e-mail informado e mostra a mensagem genérica de sucesso devolvida pelo backend", async ({
    page,
  }) => {
    let corpoEnviado: unknown = null;
    await page.route("**/auth/forgot-password", async (route) => {
      corpoEnviado = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        json: {
          message:
            "Se existir uma conta com esse e-mail, você receberá instruções para redefinir sua senha.",
        },
      });
    });

    await page.goto("/forgot-password");
    await page.getByPlaceholder("Seu e-mail").fill("cliente@sensora.dev");
    await page.getByRole("button", { name: "Enviar link de redefinição" }).click();

    await expect(page.getByRole("heading", { name: "Verifique seu e-mail" })).toBeVisible();
    await expect(page.getByText(/receberá instruções para redefinir sua senha/)).toBeVisible();
    expect(corpoEnviado).toEqual({ email: "cliente@sensora.dev" });
  });

  test("mostra a mesma mensagem genérica mesmo para um e-mail que não existe (anti-enumeração, refletindo o backend)", async ({
    page,
  }) => {
    await mockForgotPassword(page, 200, {
      message:
        "Se existir uma conta com esse e-mail, você receberá instruções para redefinir sua senha.",
    });

    await page.goto("/forgot-password");
    await page.getByPlaceholder("Seu e-mail").fill("nao-existe@sensora.dev");
    await page.getByRole("button", { name: "Enviar link de redefinição" }).click();

    await expect(page.getByRole("heading", { name: "Verifique seu e-mail" })).toBeVisible();
  });

  test("falha de rede/servidor mostra erro real, não a mensagem de sucesso", async ({ page }) => {
    await mockForgotPassword(page, 500, { message: "Internal server error" });

    await page.goto("/forgot-password");
    await page.getByPlaceholder("Seu e-mail").fill("cliente@sensora.dev");
    await page.getByRole("button", { name: "Enviar link de redefinição" }).click();

    await expect(
      page.getByText("Não foi possível enviar o e-mail. Tente novamente."),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Verifique seu e-mail" })).toHaveCount(0);
  });

  test("link 'Voltar para o login' está presente", async ({ page }) => {
    await page.goto("/forgot-password");

    await expect(page.getByRole("link", { name: "Voltar para o login" })).toBeVisible();
  });
});

test.describe("Redefinir senha — /reset-password — sem token na URL", () => {
  test("mostra 'Link inválido' e não chama reset-password", async ({ page }) => {
    const chamadas: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/reset-password")) chamadas.push(request.url());
    });

    await page.goto("/reset-password");

    await expect(page.getByRole("heading", { name: "Link inválido" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Solicitar novo link" })).toBeVisible();
    expect(chamadas).toHaveLength(0);
  });
});

test.describe("Redefinir senha — /reset-password — com token", () => {
  test("senhas que não coincidem são bloqueadas no cliente, sem chamar o backend", async ({ page }) => {
    const chamadas: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/reset-password")) chamadas.push(request.url());
    });

    await page.goto("/reset-password?token=abc123");
    await page.locator("#novaSenha").fill("senhaNova123");
    await page.locator("#confirmarNovaSenha").fill("outraSenha456");
    await page.getByRole("button", { name: "Redefinir senha" }).click();

    await expect(page.getByText("As senhas não coincidem")).toBeVisible();
    expect(chamadas).toHaveLength(0);
  });

  test("senha curta é bloqueada no cliente, sem chamar o backend", async ({ page }) => {
    const chamadas: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/reset-password")) chamadas.push(request.url());
    });

    await page.goto("/reset-password?token=abc123");
    await page.locator("#novaSenha").fill("curta");
    await page.locator("#confirmarNovaSenha").fill("curta");
    await page.getByRole("button", { name: "Redefinir senha" }).click();

    await expect(page.getByText("A nova senha deve ter no mínimo 8 caracteres")).toBeVisible();
    expect(chamadas).toHaveLength(0);
  });

  test("senha válida chama reset-password com o token da URL e mostra sucesso", async ({ page }) => {
    let corpoEnviado: unknown = null;
    await page.route("**/auth/reset-password", async (route) => {
      corpoEnviado = route.request().postDataJSON();
      await route.fulfill({ status: 200, json: { message: "Senha redefinida com sucesso." } });
    });

    await page.goto("/reset-password?token=token-valido");
    await page.locator("#novaSenha").fill("senhaNovaSegura123");
    await page.locator("#confirmarNovaSenha").fill("senhaNovaSegura123");
    await page.getByRole("button", { name: "Redefinir senha" }).click();

    await expect(page.getByRole("heading", { name: "Senha redefinida" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir para o login" })).toBeVisible();
    expect(corpoEnviado).toEqual({ token: "token-valido", novaSenha: "senhaNovaSegura123" });
  });

  test("token inválido/expirado: mostra a mensagem de erro do backend, sem navegar para sucesso", async ({
    page,
  }) => {
    await mockResetPassword(page, 401, { message: "Token inválido ou expirado" });

    await page.goto("/reset-password?token=token-expirado");
    await page.locator("#novaSenha").fill("senhaNovaSegura123");
    await page.locator("#confirmarNovaSenha").fill("senhaNovaSegura123");
    await page.getByRole("button", { name: "Redefinir senha" }).click();

    await expect(page.getByText("Token inválido ou expirado")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Senha redefinida" })).toHaveCount(0);
  });

  test("campo de senha alterna entre oculto e visível", async ({ page }) => {
    await page.goto("/reset-password?token=abc123");

    const campo = page.locator("#novaSenha");
    await expect(campo).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Mostrar nova senha" }).click();
    await expect(campo).toHaveAttribute("type", "text");
  });
});

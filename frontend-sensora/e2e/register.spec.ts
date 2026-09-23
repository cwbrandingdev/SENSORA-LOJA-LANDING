import { test, expect } from "@playwright/test";

// Cadastro em /register é o AuthSwitch já no modo criar conta (mesma
// transição do login). CPF e aceite dos termos são obrigatórios.
// POST /auth/register é interceptado — sem backend real.

const SUBMIT_BUTTON = 'form:has(#register-senha) button[type="submit"]';
const CPF_VALIDO = "52998224725";

async function preencherCadastro(
  page: import("@playwright/test").Page,
  valores: { nome?: string; email?: string; cpf?: string; senha?: string; confirmar?: string },
) {
  if (valores.nome !== undefined) await page.locator("#register-nome").fill(valores.nome);
  if (valores.email !== undefined) await page.locator("#register-email").fill(valores.email);
  if (valores.cpf !== undefined) await page.locator("#register-cpf").fill(valores.cpf);
  if (valores.senha !== undefined) await page.locator("#register-senha").fill(valores.senha);
  if (valores.confirmar !== undefined) {
    await page.locator("#register-confirmar-senha").fill(valores.confirmar);
  }
}

test.describe("Criar conta — /register", () => {
  test("sem aceitar os termos, o botão fica desabilitado e o backend não é chamado", async ({
    page,
  }) => {
    const chamadas: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/register")) chamadas.push(request.url());
    });

    await page.goto("/register");
    await preencherCadastro(page, {
      nome: "Cliente Teste",
      email: "cliente@sensora.dev",
      cpf: CPF_VALIDO,
      senha: "senhaSegura123",
      confirmar: "senhaSegura123",
    });

    await expect(page.locator(SUBMIT_BUTTON)).toBeDisabled();
    expect(chamadas).toHaveLength(0);
  });

  test("senha e repetir senha diferentes: cadastro bloqueado no frontend, sem chamar o backend", async ({
    page,
  }) => {
    const chamadas: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/register")) chamadas.push(request.url());
    });

    await page.goto("/register");
    await preencherCadastro(page, {
      nome: "Cliente Teste",
      email: "cliente@sensora.dev",
      cpf: CPF_VALIDO,
      senha: "senhaSegura123",
      confirmar: "outraSenha456",
    });
    await page.locator("#register-aceite").check();
    await page.locator(SUBMIT_BUTTON).click();

    await expect(page.getByText("As senhas não coincidem")).toBeVisible();
    expect(chamadas).toHaveLength(0);
  });

  test("CPF inválido: bloqueado no frontend, sem chamar o backend", async ({ page }) => {
    const chamadas: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/register")) chamadas.push(request.url());
    });

    await page.goto("/register");
    await preencherCadastro(page, {
      nome: "Cliente Teste",
      email: "cliente@sensora.dev",
      cpf: "111.111.111-11",
      senha: "senhaSegura123",
      confirmar: "senhaSegura123",
    });
    await page.locator("#register-aceite").check();
    await page.locator(SUBMIT_BUTTON).click();

    await expect(page.getByText("CPF inválido")).toBeVisible();
    expect(chamadas).toHaveLength(0);
  });

  test("senha com 7 caracteres: bloqueada no frontend, sem chamar o backend", async ({ page }) => {
    const chamadas: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/register")) chamadas.push(request.url());
    });

    await page.goto("/register");
    await preencherCadastro(page, {
      nome: "Cliente Teste",
      email: "cliente@sensora.dev",
      cpf: CPF_VALIDO,
      senha: "curta12",
      confirmar: "curta12",
    });
    await page.locator("#register-aceite").check();
    await page.locator(SUBMIT_BUTTON).click();

    await expect(page.getByText("A senha deve ter no mínimo 8 caracteres")).toBeVisible();
    expect(chamadas).toHaveLength(0);
  });

  test("dados válidos com aceite: chama /auth/register com CPF e mostra confirmação", async ({
    page,
  }) => {
    let corpoEnviado: unknown = null;
    await page.route("**/auth/register", async (route) => {
      corpoEnviado = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: {
          id: 999,
          nome: "Cliente Teste",
          email: "cliente@sensora.dev",
          perfil: "CLIENTE",
          ativo: true,
          emailVerificado: false,
        },
      });
    });

    await page.goto("/register");
    await preencherCadastro(page, {
      nome: "Cliente Teste",
      email: "cliente@sensora.dev",
      cpf: CPF_VALIDO,
      senha: "senhaSegura123",
      confirmar: "senhaSegura123",
    });
    await page.locator("#register-aceite").check();
    await page.locator(SUBMIT_BUTTON).click();

    await expect(page.getByText("Conta criada!")).toBeVisible();
    expect(corpoEnviado).toEqual({
      nome: "Cliente Teste",
      email: "cliente@sensora.dev",
      senha: "senhaSegura123",
      cpf: "529.982.247-25",
    });
    await expect(page).toHaveURL(/\/register$/);
    await expect(page.locator(".authswitch-container")).not.toHaveClass(/sign-up-mode/, {
      timeout: 3000,
    });
    await expect(page.getByText("Conta criada!")).toBeVisible();
  });

  test("mostrar uma senha revela as duas; ocultar esconde as duas", async ({ page }) => {
    await page.goto("/register");

    const senha = page.locator("#register-senha");
    const confirmarSenha = page.locator("#register-confirmar-senha");
    await expect(senha).toHaveAttribute("type", "password");
    await expect(confirmarSenha).toHaveAttribute("type", "password");

    const confirmarSenhaWrapper = page.locator(
      ".authswitch-input-field:has(#register-confirmar-senha)",
    );
    await confirmarSenhaWrapper.getByRole("button").click();
    await expect(confirmarSenha).toHaveAttribute("type", "text");
    await expect(senha).toHaveAttribute("type", "text");

    await page.locator(".authswitch-input-field:has(#register-senha)").getByRole("button").click();
    await expect(senha).toHaveAttribute("type", "password");
    await expect(confirmarSenha).toHaveAttribute("type", "password");
  });

  test("enquanto digita, mostra se as senhas coincidem", async ({ page }) => {
    await page.goto("/register");
    await page.locator("#register-senha").fill("senhaSegura123");
    await page.locator("#register-confirmar-senha").fill("outra");
    await expect(page.getByText("As senhas não coincidem")).toBeVisible();
    await page.locator("#register-confirmar-senha").fill("senhaSegura123");
    await expect(page.getByText("As senhas coincidem")).toBeVisible();
  });
});

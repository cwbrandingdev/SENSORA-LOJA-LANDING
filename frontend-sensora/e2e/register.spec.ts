import { test, expect } from "@playwright/test";

// Etapa (Repetir senha) — suíte E2E de /register (SignUpForm, dentro de
// components/auth/AuthSwitch.tsx). Não existia nenhuma suíte para este
// formulário antes desta etapa (achado da vistoria anterior). Mesmo padrão
// de mock via page.route já usado em e2e/recuperacao-senha.spec.ts —
// intercepta POST /auth/register com respostas controladas, sem depender de
// um backend real.
//
// SignInForm e SignUpForm ficam sempre os dois montados no DOM (alternam via
// opacity/z-index, não por desmontagem — ver AuthSwitch.tsx), então ids
// (#register-*) são usados em vez de getByLabel/getByPlaceholder para nunca
// ser ambíguo com o formulário de login, mesmo padrão já usado em
// e2e/checkout.spec.ts para #login-email/#login-senha. O botão de submit é
// sempre escopado ao form (`form:has(#register-senha) button[type="submit"]`)
// porque o painel de marca ao lado também tem um botão de texto "Criar
// conta" (troca de modo), que colidiria com getByRole se não escopado.
//
// Etapa (Toast de cadastro) — a mensagem de sucesso deixou de ser o
// role="status" inline dentro do próprio form (substituído por um Toast via
// useToast()/ToastProvider, ver AuthSwitch.tsx). getByRole("status") não é
// mais usado para essa asserção de propósito: o ToastViewport também usa
// role="status" para os próprios toasts, então localizar por texto exato
// (getByText) é o que não é ambíguo aqui.

const SUBMIT_BUTTON = 'form:has(#register-senha) button[type="submit"]';

test.describe("Criar conta — /register", () => {
  test("senha e repetir senha diferentes: cadastro bloqueado no frontend, sem chamar o backend", async ({
    page,
  }) => {
    const chamadas: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/register")) chamadas.push(request.url());
    });

    await page.goto("/register");
    await page.locator("#register-nome").fill("Cliente Teste");
    await page.locator("#register-email").fill("cliente@sensora.dev");
    await page.locator("#register-senha").fill("senhaSegura123");
    await page.locator("#register-confirmar-senha").fill("outraSenha456");
    await page.locator(SUBMIT_BUTTON).click();

    await expect(page.getByText("As senhas não coincidem")).toBeVisible();
    expect(chamadas).toHaveLength(0);
  });

  test("senha com 7 caracteres: bloqueada no frontend, sem chamar o backend", async ({
    page,
  }) => {
    const chamadas: unknown[] = [];
    page.on("request", (request) => {
      if (request.url().includes("/auth/register")) chamadas.push(request.url());
    });

    await page.goto("/register");
    await page.locator("#register-nome").fill("Cliente Teste");
    await page.locator("#register-email").fill("cliente@sensora.dev");
    await page.locator("#register-senha").fill("curta12");
    await page.locator("#register-confirmar-senha").fill("curta12");
    await page.locator(SUBMIT_BUTTON).click();

    await expect(
      page.getByText("A senha deve ter no mínimo 8 caracteres"),
    ).toBeVisible();
    expect(chamadas).toHaveLength(0);
  });

  test("senha válida com confirmação igual: chama /auth/register sem confirmarSenha e mostra Toast de sucesso", async ({
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
    await page.locator("#register-nome").fill("Cliente Teste");
    await page.locator("#register-email").fill("cliente@sensora.dev");
    await page.locator("#register-senha").fill("senhaSegura123");
    await page.locator("#register-confirmar-senha").fill("senhaSegura123");
    await page.locator(SUBMIT_BUTTON).click();

    // O Toast (toast.success) é disparado assim que o cadastro é concluído
    // — antes mesmo do setTimeout(onSuccess, 2200) que troca para o modo
    // Login — mas expect(...).toBeVisible() já espera/retenta sozinho, sem
    // precisar de wait manual. Texto exato via getByText (não getByRole
    // "status": o ToastViewport usa o mesmo role para qualquer toast).
    await expect(page.getByText("Conta criada!")).toBeVisible();
    expect(corpoEnviado).toEqual({
      nome: "Cliente Teste",
      email: "cliente@sensora.dev",
      senha: "senhaSegura123",
    });

    // Confirma que nenhuma navegação para /login aconteceu — a troca para o
    // modo Login continua sendo só a animação local do AuthSwitch (estado
    // React), a URL permanece /register (ver comentário em onSubmit).
    await expect(page).toHaveURL(/\/register$/);

    // Aguarda a janela de 2,2s até o AuthSwitch trocar para o modo Login
    // (onSuccess remove a classe "sign-up-mode" do container — SignInForm/
    // SignUpForm ficam sempre os dois montados, alternando via CSS, então a
    // classe do container é o sinal real da troca de modo, não a
    // visibilidade dos campos, que o Playwright não trata como oculta só
    // por opacity:0) e confirma que o Toast, disparado bem antes desse
    // ponto, continua de pé (auto-dismiss só em 4s) — a troca de modo não
    // derruba nem duplica o Toast.
    await expect(page.locator(".authswitch-container")).not.toHaveClass(
      /sign-up-mode/,
      { timeout: 3000 },
    );
    await expect(page.getByText("Conta criada!")).toBeVisible();
    await expect(page).toHaveURL(/\/register$/);
  });

  test("campo 'Repetir senha' alterna entre oculto e visível, independente do campo 'Senha'", async ({
    page,
  }) => {
    await page.goto("/register");

    const senha = page.locator("#register-senha");
    const confirmarSenha = page.locator("#register-confirmar-senha");
    await expect(senha).toHaveAttribute("type", "password");
    await expect(confirmarSenha).toHaveAttribute("type", "password");

    // Escopado ao wrapper do próprio campo (não por texto do aria-label,
    // que é igual em todos os campos de senha da página — login, senha e
    // repetir senha) para nunca clicar no botão errado.
    const confirmarSenhaWrapper = page.locator(
      ".authswitch-input-field:has(#register-confirmar-senha)",
    );
    await confirmarSenhaWrapper.getByRole("button").click();
    await expect(confirmarSenha).toHaveAttribute("type", "text");
    // O toggle do campo "Senha" é independente — não deve ter sido afetado.
    await expect(senha).toHaveAttribute("type", "password");
  });
});

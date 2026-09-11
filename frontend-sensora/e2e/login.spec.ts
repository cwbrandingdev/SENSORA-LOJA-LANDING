import { test, expect } from "@playwright/test";

// Etapa (Toast de login) — suíte E2E de /login (SignInForm, dentro de
// components/auth/AuthSwitch.tsx). Não existia nenhuma suíte dedicada a este
// formulário antes desta etapa — login válido já era coberto indiretamente
// por e2e/checkout.spec.ts (Task 7), mas credenciais inválidas nunca tinham
// asserção própria.
//
// SignInForm e SignUpForm ficam sempre os dois montados no DOM (alternam via
// opacity/z-index, não por desmontagem — ver AuthSwitch.tsx), então ids
// (#login-*) são usados em vez de getByLabel/getByPlaceholder para nunca ser
// ambíguo com o formulário de cadastro, mesmo padrão já usado em
// e2e/checkout.spec.ts e e2e/register.spec.ts. O botão de submit é sempre
// escopado ao form (`form:has(#login-senha) button[type="submit"]`) porque o
// painel de marca ao lado também tem um botão de texto "Entrar" (troca de
// modo), que colidiria com getByRole se não escopado.

const SUBMIT_BUTTON = 'form:has(#login-senha) button[type="submit"]';

test.describe("Entrar — /login", () => {
  test("credenciais inválidas (401): mostra Toast de erro, sem mensagem inline", async ({
    page,
  }) => {
    await page.route("**/auth/login", async (route) => {
      await route.fulfill({ status: 401, json: { message: "Unauthorized" } });
    });

    await page.goto("/login");
    await page.locator("#login-email").fill("cliente@sensora.dev");
    await page.locator("#login-senha").fill("senhaErrada123");
    await page.locator(SUBMIT_BUTTON).click();

    // Toast (toast.error), não a antiga mensagem inline — getByText, não
    // getByRole("status"): o ToastViewport usa esse role para qualquer
    // toast, então texto exato é o que não é ambíguo aqui.
    await expect(page.getByText("Email ou senha inválidos.")).toBeVisible();

    // Confirma que a mensagem NÃO aparece mais também como alerta inline do
    // próprio formulário de login (.authswitch-alert dentro do
    // .authswitch-sign-in-form, ver AuthSwitch.tsx) — prova que a exibição
    // realmente migrou para o Toast, não foi só duplicada. Escopado ao
    // formulário (não getByRole("alert") puro): o Next.js dev/App Router
    // injeta seu próprio elemento role="alert" (route announcer) fora do
    // formulário, que não tem relação com este erro.
    await expect(
      page.locator(".authswitch-sign-in-form .authswitch-alert"),
    ).toHaveCount(0);

    // Sem navegação nem alteração de sessão nesse caminho.
    await expect(page).toHaveURL(/\/login$/);
  });

  test("erro de rede/servidor (não-401): mantém a mensagem inline existente, sem Toast", async ({
    page,
  }) => {
    await page.route("**/auth/login", async (route) => {
      await route.fulfill({ status: 500, json: { message: "Internal server error" } });
    });

    await page.goto("/login");
    await page.locator("#login-email").fill("cliente@sensora.dev");
    await page.locator("#login-senha").fill("qualquerSenha123");
    await page.locator(SUBMIT_BUTTON).click();

    // Este caminho de erro não foi migrado para Toast — continua inline
    // (.authswitch-alert dentro do form de login), comportamento preservado
    // conforme a etapa pediu. Escopado ao form pelo mesmo motivo do teste
    // acima (Next.js injeta seu próprio elemento role="alert" fora do form).
    await expect(
      page.locator(".authswitch-sign-in-form .authswitch-alert"),
    ).toHaveText("Não foi possível conectar ao servidor.");
    await expect(page.getByText("Email ou senha inválidos.")).toHaveCount(0);
  });
});

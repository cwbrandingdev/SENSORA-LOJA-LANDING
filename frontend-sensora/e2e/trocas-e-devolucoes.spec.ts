import { test, expect, type Page } from "@playwright/test";
import { mockCarrinhoApi } from "./mock-carrinho-api";

// Política de Trocas e Devoluções — orienta o cliente para o formulário
// existente (Minha Conta → Meus Pedidos → pedido → Solicitar devolução) e
// mantém suporte@sensorahome.com.br explícito como canal de contato.
// Nenhuma chamada real de API: /pedidos/meus é interceptada.

const TOKEN_KEY = "sensora_token";
const EMAIL_SUPORTE = "suporte@sensorahome.com.br";

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
  await mockCarrinhoApi(page);
}

test.describe("Política de Trocas e Devoluções", () => {
  test("mostra o e-mail de suporte, com mailto funcional", async ({ page }) => {
    await page.goto("/trocas-e-devolucoes");

    const links = page.locator(`a[href^="mailto:${EMAIL_SUPORTE}"]`);
    await expect(links.first()).toBeVisible();
    await expect(links.first()).toHaveText(EMAIL_SUPORTE);
  });

  test("orienta o uso do formulário Solicitar devolução em Meus Pedidos", async ({ page }) => {
    await page.goto("/trocas-e-devolucoes");

    await expect(page.getByText("Solicitar devolução").first()).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Minha Conta → Meus Pedidos" }),
    ).toHaveAttribute("href", "/conta/pedidos");
  });

  test("sem sessão, o link de Meus Pedidos leva ao login e volta para lá", async ({ page }) => {
    await page.goto("/trocas-e-devolucoes");
    await page.getByRole("link", { name: "Minha Conta → Meus Pedidos" }).click();

    await expect(page).toHaveURL(/\/login\?redirect=%2Fconta%2Fpedidos$/);
  });

  test("com sessão, o link de Meus Pedidos abre a lista de pedidos", async ({ page }) => {
    await seedSession(page);
    await page.route("**/pedidos/meus", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({ json: [] });
    });

    await page.goto("/trocas-e-devolucoes");
    await page.getByRole("link", { name: "Minha Conta → Meus Pedidos" }).click();

    await expect(page).toHaveURL(/\/conta\/pedidos$/);
  });
});

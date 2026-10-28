import type { Page } from "@playwright/test";

// Intercepta só a API GET/PUT /carrinho (pathname exato), nunca a página
// /loja/carrinho. Sem isso, o CartProvider com sessão falsa esperaria o
// backend real (timeout) ou tomaria 401.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
};

export async function mockCarrinhoApi(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === "/carrinho",
    async (route) => {
      const method = route.request().method();
      if (method === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS });
        return;
      }
      if (method === "GET" || method === "PUT") {
        await route.fulfill({
          headers: { ...CORS, "Content-Type": "application/json" },
          json: { itens: [] },
        });
        return;
      }
      await route.fallback();
    },
  );
}

import { test, expect, type Page } from "@playwright/test";

// Task 13 (+ Task 21 — migração Stripe → Asaas, sem impacto nesta página) —
// suíte E2E de /checkout/cancelado. Mesma filosofia de
// e2e/checkout-sucesso.spec.ts (Task 12): esta página não depende de
// sessão, backend ou query params (a task explicitamente proíbe usar
// session_id ou qualquer param para tomar decisões), então os testes não
// precisam de mocks de rede — só confirmam a renderização, os CTAs e as
// invariantes de segurança/escopo (sem chamadas de pagamento/pedido, sem
// alteração do carrinho).
const CANCELADO_URL = "/checkout/cancelado";
const CART_STORAGE_KEY = "sensora_carrinho";

const CART_ITEM = {
  produtoId: 101,
  nome: "Vela Aromática Lavanda",
  slug: "vela-aromatica-lavanda",
  preco: 59.9,
  quantidade: 2,
};

// Tolerância consistente com e2e/checkout.spec.ts e
// e2e/checkout-sucesso.spec.ts — o Navbar (fora do escopo desta task) já
// produz uma diferença de ~12px entre scrollWidth e innerWidth em toda
// página do site.
async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 24);
}

// Nenhuma chamada de pagamento ou pedido deve existir nesta página — ela
// não chama o backend nem o Asaas (gateway ativo a partir da Task 21), só é
// o destino de retorno.
function trackForbiddenCalls(page: Page) {
  const chamadas: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (
      url.includes("/checkout/session") ||
      url.includes("asaas.com") ||
      url.includes("/pedidos") ||
      url.includes("/itens-pedido")
    ) {
      chamadas.push(url);
    }
  });
  return chamadas;
}

test.describe("Checkout cancelado — renderização e conteúdo", () => {
  test("responde corretamente", async ({ page }) => {
    const response = await page.goto(CANCELADO_URL);
    expect(response?.status()).toBe(200);
  });

  test("existe exatamente um h1 e o título informa claramente que o pagamento não foi concluído", async ({
    page,
  }) => {
    await page.goto(CANCELADO_URL);

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText("Pagamento não concluído");
  });

  test("mensagem não inventa número de pedido nem valor em R$", async ({ page }) => {
    await page.goto(CANCELADO_URL);

    const mensagem = page.getByText("O pagamento foi cancelado ou interrompido", {
      exact: false,
    });
    await expect(mensagem).toBeVisible();

    const textoVisivel = await page.locator("body").innerText();
    expect(textoVisivel).not.toMatch(/pedido\s*#|número do pedido|R\$\s*\d/i);
  });
});

test.describe("Checkout cancelado — CTAs", () => {
  test("CTA principal leva para /loja", async ({ page }) => {
    await page.goto(CANCELADO_URL);

    const ctaPrincipal = page.getByRole("link", { name: "Voltar para a loja →" });
    await expect(ctaPrincipal).toBeVisible();
    await expect(ctaPrincipal).toHaveAttribute("href", "/loja");

    await ctaPrincipal.click();
    await expect(page).toHaveURL(/\/loja$/);
  });

  test("CTA secundário leva para uma rota interna válida (/loja/carrinho)", async ({ page }) => {
    await page.goto(CANCELADO_URL);

    const ctaSecundario = page.getByRole("link", { name: "Voltar ao carrinho" });
    await expect(ctaSecundario).toBeVisible();
    const href = await ctaSecundario.getAttribute("href");
    expect(href).toBe("/loja/carrinho");
    // Rota interna — nunca externa/arbitrária.
    expect(href?.startsWith("/")).toBe(true);
    expect(href).not.toMatch(/^https?:\/\//);

    await ctaSecundario.click();
    await expect(page).toHaveURL(/\/loja\/carrinho$/);
  });

  test("CTAs são alcançáveis e ativáveis por teclado", async ({ page }) => {
    await page.goto(CANCELADO_URL);

    const ctaPrincipal = page.getByRole("link", { name: "Voltar para a loja →" });
    await ctaPrincipal.focus();
    await expect(ctaPrincipal).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/loja$/);
  });
});

test.describe("Checkout cancelado — escopo e segurança (não pertence à Task 13)", () => {
  test("nenhuma chamada a /checkout/session, Asaas ou pedidos acontece nesta página", async ({
    page,
  }) => {
    const chamadas = trackForbiddenCalls(page);

    await page.goto(CANCELADO_URL);
    await page.waitForLoadState("networkidle");

    expect(chamadas).toEqual([]);
  });

  test("carrinho permanece byte-a-byte idêntico antes e depois da visita", async ({ page }) => {
    const carrinhoAntes = JSON.stringify([CART_ITEM]);

    await page.addInitScript(
      ([key, itensJson]) => window.localStorage.setItem(key, itensJson),
      [CART_STORAGE_KEY, carrinhoAntes] as const,
    );

    await page.goto(CANCELADO_URL);
    await page.waitForLoadState("networkidle");

    const carrinhoDepois = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      CART_STORAGE_KEY,
    );

    expect(carrinhoDepois).toBe(carrinhoAntes);
  });

  test("não depende de query params para decidir o que renderizar — mesmo conteúdo com ?session_id=test", async ({
    page,
  }) => {
    await page.goto(`${CANCELADO_URL}?session_id=test`);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Pagamento não concluído");
    // O parâmetro nunca deve aparecer refletido no conteúdo visível da
    // página (nenhuma lógica de eco/uso do parâmetro). Checado no texto
    // visível (innerText), não em textContent — este último inclui o
    // conteúdo de <script> injetados pelo Next (hidratação, webpack), onde
    // a substring poderia aparecer por coincidência sem relação nenhuma
    // com o parâmetro sendo ecoado de verdade.
    const textoVisivel = await page.locator("body").innerText();
    expect(textoVisivel).not.toContain("session_id=test");
    expect(textoVisivel).not.toContain("cs_test");
  });
});

test.describe("Checkout cancelado — console e responsividade", () => {
  test("sem erros reais no console", async ({ page }) => {
    const erros: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") erros.push(msg.text());
    });
    page.on("pageerror", (err) => erros.push(err.message));

    await page.goto(CANCELADO_URL);
    await page.getByRole("heading", { level: 1 }).waitFor();

    expect(erros).toEqual([]);
  });

  for (const { nome, width, height } of [
    { nome: "desktop 1440px", width: 1440, height: 900 },
    { nome: "tablet 768px", width: 768, height: 1024 },
    { nome: "mobile 375px", width: 375, height: 812 },
  ]) {
    test(`sem overflow horizontal em ${nome}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(CANCELADO_URL);
      await page.getByRole("heading", { level: 1 }).waitFor();

      expect(await hasHorizontalOverflow(page)).toBe(false);

      await expect(page.getByRole("link", { name: "Voltar para a loja →" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Voltar ao carrinho" })).toBeVisible();
    });
  }
});

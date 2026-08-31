import { test, expect, type Page } from "@playwright/test";

// Task 12 (+ Task 21 — migração Stripe → Asaas: texto neutro, sem citar
// gateway) — suíte E2E de /checkout/sucesso. Esta página não depende de
// sessão, backend ou query params (task explicitamente não valida
// session_id nesta etapa), então os testes não precisam de mocks de rede —
// só confirmam a renderização, os CTAs e as invariantes de segurança/escopo
// (sem chamadas de pagamento, sem alteração do carrinho).
const SUCESSO_URL = "/checkout/sucesso";
const CART_STORAGE_KEY = "sensora_carrinho";

const CART_ITEM = {
  produtoId: 101,
  nome: "Vela Aromática Lavanda",
  slug: "vela-aromatica-lavanda",
  preco: 59.9,
  quantidade: 2,
};

// Tolerância consistente com e2e/checkout.spec.ts — o Navbar (fora do
// escopo desta task) já produz uma diferença de ~12px entre scrollWidth e
// innerWidth em toda página do site.
async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 24);
}

// Nenhuma chamada de pagamento deve existir nesta página — ela não chama o
// backend nem o Asaas (gateway ativo a partir da Task 21), só é o destino
// de retorno.
function trackPaymentCalls(page: Page) {
  const chamadas: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (url.includes("/checkout/session") || url.includes("asaas.com")) {
      chamadas.push(url);
    }
  });
  return chamadas;
}

test.describe("Checkout sucesso — renderização e conteúdo", () => {
  test("responde corretamente e renderiza o estado de sucesso", async ({ page }) => {
    const response = await page.goto(SUCESSO_URL);
    expect(response?.status()).toBe(200);

    // Ícone decorativo (check-circle) — aria-hidden, não deve ter accessible
    // name própria disputando com o título.
    const icone = page.locator('[aria-hidden="true"] svg');
    await expect(icone).toBeVisible();
  });

  test("título está presente com hierarquia semântica correta", async ({ page }) => {
    await page.goto(SUCESSO_URL);

    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toHaveText("Pagamento realizado com sucesso");

    // Único h1 da página — nenhuma hierarquia de heading quebrada.
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  });

  test("mensagem explicativa está presente e não inventa dados de pedido/pagamento", async ({
    page,
  }) => {
    await page.goto(SUCESSO_URL);

    const mensagem = page.getByText("Seu pagamento foi concluído com sucesso", {
      exact: false,
    });
    await expect(mensagem).toBeVisible();

    // Nunca cita o nome do gateway (Stripe/Asaas) — mensagem neutra de
    // propósito (Task 21). Nada de número de pedido, valor específico ou
    // linguagem de confirmação pelo backend/webhook — isso é Task 13/14/15.
    const corpoSemGateway = await page.locator("body").innerText();
    expect(corpoSemGateway).not.toMatch(/stripe|asaas/i);
    const corpo = await page.textContent("body");
    expect(corpo).not.toMatch(/pedido\s*#|número do pedido|R\$\s*\d/i);
  });
});

test.describe("Checkout sucesso — CTAs", () => {
  test("CTA principal leva para /loja", async ({ page }) => {
    await page.goto(SUCESSO_URL);

    const ctaPrincipal = page.getByRole("link", { name: "Voltar para a loja →" });
    await expect(ctaPrincipal).toBeVisible();
    await expect(ctaPrincipal).toHaveAttribute("href", "/loja");

    await ctaPrincipal.click();
    await expect(page).toHaveURL(/\/loja$/);
  });

  test("CTA secundário leva para /loja/produtos", async ({ page }) => {
    await page.goto(SUCESSO_URL);

    const ctaSecundario = page.getByRole("link", { name: "Continuar comprando" });
    await expect(ctaSecundario).toBeVisible();
    await expect(ctaSecundario).toHaveAttribute("href", "/loja/produtos");

    await ctaSecundario.click();
    await expect(page).toHaveURL(/\/loja\/produtos$/);
  });

  test("CTAs são alcançáveis e ativáveis por teclado", async ({ page }) => {
    await page.goto(SUCESSO_URL);

    const ctaPrincipal = page.getByRole("link", { name: "Voltar para a loja →" });
    await ctaPrincipal.focus();
    await expect(ctaPrincipal).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/loja$/);
  });
});

test.describe("Checkout sucesso — escopo e segurança (não pertence à Task 12)", () => {
  test("nenhuma chamada a /checkout/session ou ao Asaas acontece nesta página", async ({
    page,
  }) => {
    const chamadas = trackPaymentCalls(page);

    await page.goto(SUCESSO_URL);
    await page.waitForLoadState("networkidle");

    expect(chamadas).toEqual([]);
  });

  test("carrinho não é alterado ao visitar a página de sucesso", async ({ page }) => {
    await page.addInitScript(
      ([key, itensJson]) => window.localStorage.setItem(key, itensJson),
      [CART_STORAGE_KEY, JSON.stringify([CART_ITEM])] as const,
    );

    await page.goto(SUCESSO_URL);
    await page.waitForLoadState("networkidle");

    const cartRaw = await page.evaluate(
      (key) => window.localStorage.getItem(key),
      CART_STORAGE_KEY,
    );
    expect(JSON.parse(cartRaw ?? "[]")).toEqual([CART_ITEM]);
  });

  test("não depende de query params do gateway de pagamento — renderiza igual com ou sem session_id", async ({
    page,
  }) => {
    await page.goto(`${SUCESSO_URL}?session_id=cs_test_qualquer_coisa`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Pagamento realizado com sucesso",
    );
  });
});

test.describe("Checkout sucesso — console e responsividade", () => {
  test("sem erros reais no console", async ({ page }) => {
    const erros: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") erros.push(msg.text());
    });
    page.on("pageerror", (err) => erros.push(err.message));

    await page.goto(SUCESSO_URL);
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
      await page.goto(SUCESSO_URL);
      await page.getByRole("heading", { level: 1 }).waitFor();

      expect(await hasHorizontalOverflow(page)).toBe(false);

      await expect(page.getByRole("link", { name: "Voltar para a loja →" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Continuar comprando" })).toBeVisible();
    });
  }
});

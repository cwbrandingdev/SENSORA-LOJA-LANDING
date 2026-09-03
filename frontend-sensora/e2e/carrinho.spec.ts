import { test, expect, type Page } from "@playwright/test";

// Task 17 — primeira suíte E2E dedicada a /loja/carrinho. A página não
// chama nenhuma API (100% CartContext/localStorage) exceto a decisão de
// destino do CTA de checkout (possuiSessaoValida(), sem rede) — não precisa
// de mocks de backend, só semear localStorage, mesmo padrão de
// e2e/checkout.spec.ts.
const CARRINHO_URL = "/loja/carrinho";
const CART_STORAGE_KEY = "sensora_carrinho";
const TOKEN_KEY = "sensora_token";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const ITEM_VELA = {
  produtoId: 101,
  nome: "Vela Aromática Lavanda",
  slug: "vela-aromatica-lavanda",
  preco: 59.9,
  quantidade: 2,
};

const ITEM_SPRAY = {
  produtoId: 102,
  nome: "Spray de Ambiente Cedro",
  slug: "spray-cedro",
  preco: 44.5,
  quantidade: 1,
};

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

async function seedCart(page: Page, itens: unknown[]) {
  await page.addInitScript(
    ([key, itensJson]) => window.localStorage.setItem(key, itensJson),
    [CART_STORAGE_KEY, JSON.stringify(itens)] as const,
  );
}

async function seedSession(page: Page) {
  await page.addInitScript(
    ([key, token]) => window.localStorage.setItem(key, token),
    [TOKEN_KEY, fakeToken()] as const,
  );
}

// Mesma tolerância usada em e2e/checkout.spec.ts — o Navbar (fora do
// escopo desta task) já produz uma diferença de ~12px entre scrollWidth e
// innerWidth em toda página do site, sem overflow real.
async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 24);
}

test.describe("Carrinho — carrinho vazio", () => {
  test("mostra EmptyState com CTA para o catálogo", async ({ page }) => {
    await page.goto(CARRINHO_URL);

    await expect(page.getByText("Ainda não há nada por aqui")).toBeVisible();
    const cta = page.getByRole("link", { name: "Ver catálogo →" });
    await expect(cta).toBeVisible();
    await expect(cta).toHaveAttribute("href", "/loja/produtos");

    expect(await hasHorizontalOverflow(page)).toBe(false);
  });
});

test.describe("Carrinho — conteúdo e cálculo", () => {
  test("um produto: mostra nome, preço unitário, quantidade e subtotal corretos", async ({
    page,
  }) => {
    await seedCart(page, [ITEM_VELA]);
    await page.goto(CARRINHO_URL);

    const linha = page.locator("ul.divide-y > li").filter({ hasText: "Vela Aromática Lavanda" });
    await expect(linha).toBeVisible();
    await expect(linha).toContainText(formatPrice.format(59.9));
    await expect(linha.getByText("2", { exact: true })).toBeVisible();
    await expect(linha).toContainText(formatPrice.format(119.8));

    const subtotalRow = page.getByText("Subtotal", { exact: true }).locator("..");
    await expect(subtotalRow).toContainText(formatPrice.format(119.8));
    const totalRow = page.getByText("Total", { exact: true }).locator("..");
    await expect(totalRow).toContainText(formatPrice.format(119.8));
  });

  test("múltiplos produtos: todos aparecem e o subtotal geral soma corretamente", async ({
    page,
  }) => {
    await seedCart(page, [ITEM_VELA, ITEM_SPRAY]);
    await page.goto(CARRINHO_URL);

    await expect(page.locator("ul.divide-y > li")).toHaveCount(2);
    await expect(page.locator("ul.divide-y > li").filter({ hasText: "Vela Aromática Lavanda" })).toBeVisible();
    await expect(page.locator("ul.divide-y > li").filter({ hasText: "Spray de Ambiente Cedro" })).toBeVisible();

    // 2×59,90 + 1×44,50 = 164,30
    const totalEsperado = formatPrice.format(164.3);
    const subtotalRow = page.getByText("Subtotal", { exact: true }).locator("..");
    await expect(subtotalRow).toContainText(totalEsperado);
  });

  test("cabeçalho mostra a contagem correta de itens", async ({ page }) => {
    await seedCart(page, [ITEM_VELA, ITEM_SPRAY]);
    await page.goto(CARRINHO_URL);

    // 2 (Vela) + 1 (Spray) = 3 itens.
    await expect(page.getByText("3 itens prontos para o checkout.")).toBeVisible();
  });
});

test.describe("Carrinho — alteração de quantidade", () => {
  test("aumentar quantidade recalcula subtotal do item e o total geral", async ({ page }) => {
    await seedCart(page, [ITEM_VELA]);
    await page.goto(CARRINHO_URL);

    const linha = page.locator("ul.divide-y > li").filter({ hasText: "Vela Aromática Lavanda" });
    await linha.getByRole("button", { name: "Aumentar quantidade" }).click();

    await expect(linha.getByText("3", { exact: true })).toBeVisible();
    await expect(linha).toContainText(formatPrice.format(179.7));
    const totalRow = page.getByText("Total", { exact: true }).locator("..");
    await expect(totalRow).toContainText(formatPrice.format(179.7));
  });

  test("diminuir quantidade recalcula, e não desce de 1", async ({ page }) => {
    await seedCart(page, [{ ...ITEM_VELA, quantidade: 1 }]);
    await page.goto(CARRINHO_URL);

    const linha = page.locator("ul.divide-y > li").filter({ hasText: "Vela Aromática Lavanda" });
    const diminuir = linha.getByRole("button", { name: "Diminuir quantidade" });

    await expect(diminuir).toBeDisabled();
    await expect(linha.getByText("1", { exact: true })).toBeVisible();
  });

  test("mudança de quantidade persiste no localStorage", async ({ page }) => {
    await seedCart(page, [ITEM_VELA]);
    await page.goto(CARRINHO_URL);

    await page
      .locator("ul.divide-y > li")
      .filter({ hasText: "Vela Aromática Lavanda" })
      .getByRole("button", { name: "Aumentar quantidade" })
      .click();

    const cartRaw = await page.evaluate((key) => window.localStorage.getItem(key), CART_STORAGE_KEY);
    const itens = JSON.parse(cartRaw ?? "[]");
    expect(itens).toEqual([{ ...ITEM_VELA, quantidade: 3 }]);
  });
});

test.describe("Carrinho — remoção", () => {
  test("remover um item entre vários: some da lista, mostra toast, mantém o resto", async ({
    page,
  }) => {
    await seedCart(page, [ITEM_VELA, ITEM_SPRAY]);
    await page.goto(CARRINHO_URL);

    await page.getByRole("button", { name: 'Remover "Vela Aromática Lavanda" do carrinho' }).click();

    await expect(page.getByText('"Vela Aromática Lavanda" removido do carrinho.')).toBeVisible();
    await expect(page.locator("ul.divide-y > li")).toHaveCount(1);
    await expect(page.locator("ul.divide-y > li").filter({ hasText: "Spray de Ambiente Cedro" })).toBeVisible();
  });

  test("remover o único item: volta ao estado vazio", async ({ page }) => {
    await seedCart(page, [ITEM_VELA]);
    await page.goto(CARRINHO_URL);

    await page.getByRole("button", { name: 'Remover "Vela Aromática Lavanda" do carrinho' }).click();

    await expect(page.getByText("Ainda não há nada por aqui")).toBeVisible();
  });

  test("esvaziar carrinho: confirma, limpa tudo e mostra toast", async ({ page }) => {
    await seedCart(page, [ITEM_VELA, ITEM_SPRAY]);
    page.on("dialog", (dialog) => dialog.accept());

    await page.goto(CARRINHO_URL);
    await page.getByRole("button", { name: "Esvaziar carrinho" }).click();

    await expect(page.getByText("Carrinho esvaziado.")).toBeVisible();
    await expect(page.getByText("Ainda não há nada por aqui")).toBeVisible();

    const cartRaw = await page.evaluate((key) => window.localStorage.getItem(key), CART_STORAGE_KEY);
    expect(JSON.parse(cartRaw ?? "[]")).toEqual([]);
  });

  test("esvaziar carrinho: cancelar a confirmação mantém os itens", async ({ page }) => {
    await seedCart(page, [ITEM_VELA]);
    page.on("dialog", (dialog) => dialog.dismiss());

    await page.goto(CARRINHO_URL);
    await page.getByRole("button", { name: "Esvaziar carrinho" }).click();

    await expect(page.locator("ul.divide-y > li")).toHaveCount(1);
  });
});

// Etapa 6.6 (aviso de estoque) — o carrinho é 100% CartContext/localStorage
// (ver comentário no topo do arquivo), então `estoqueConhecido` é seedado
// direto no item, do mesmo jeito que os outros campos — sem precisar de
// mock de API pública (que aqui nem seria possível: a página de produto que
// gera esse snapshot é Server Component, fora do alcance de page.route; ver
// e2e/estoque-disponibilidade.spec.ts para a regra pura que decide as
// mensagens abaixo).
test.describe("Carrinho — limite de estoque no stepper", () => {
  test("estoque conhecido 5, quantidade 2: aumentar até o limite desabilita o \"+\"", async ({
    page,
  }) => {
    await seedCart(page, [{ ...ITEM_VELA, quantidade: 2, estoqueConhecido: 5 }]);
    await page.goto(CARRINHO_URL);

    const linha = page.locator("ul.divide-y > li").filter({ hasText: "Vela Aromática Lavanda" });
    const aumentar = linha.getByRole("button", { name: "Aumentar quantidade" });

    await aumentar.click();
    await aumentar.click();
    await aumentar.click();
    await expect(linha.getByText("5", { exact: true })).toBeVisible();
    await expect(aumentar).toBeDisabled();
  });

  test("estoque conhecido 0: \"+\" nasce desabilitado e o problema é sinalizado", async ({
    page,
  }) => {
    await seedCart(page, [{ ...ITEM_VELA, quantidade: 1, estoqueConhecido: 0 }]);
    await page.goto(CARRINHO_URL);

    const linha = page.locator("ul.divide-y > li").filter({ hasText: "Vela Aromática Lavanda" });
    await expect(linha.getByRole("button", { name: "Aumentar quantidade" })).toBeDisabled();
    // Com 1 unidade no carrinho e 0 em estoque, é o aviso de "problema" (não
    // mais o de "poucas unidades") que aparece — ver CartItemRow.
    await expect(linha).toContainText("Estoque disponível: 0");
  });

  test("sem estoqueConhecido salvo (carrinho anterior a esta mudança): \"+\" continua sem teto", async ({
    page,
  }) => {
    await seedCart(page, [ITEM_VELA]);
    await page.goto(CARRINHO_URL);

    const linha = page.locator("ul.divide-y > li").filter({ hasText: "Vela Aromática Lavanda" });
    const aumentar = linha.getByRole("button", { name: "Aumentar quantidade" });

    await aumentar.click();
    await expect(linha.getByText("3", { exact: true })).toBeVisible();
    await expect(aumentar).toBeEnabled();
  });
});

test.describe("Carrinho — quantidade acima do estoque conhecido", () => {
  test("informa o problema claramente, sem remover nem ajustar a quantidade sozinho", async ({
    page,
  }) => {
    await seedCart(page, [{ ...ITEM_VELA, quantidade: 4, estoqueConhecido: 2 }]);
    await page.goto(CARRINHO_URL);

    const linha = page.locator("ul.divide-y > li").filter({ hasText: "Vela Aromática Lavanda" });
    await expect(linha).toContainText("Estoque disponível: 2");
    // A quantidade guardada pelo cliente continua intacta.
    await expect(linha.getByText("4", { exact: true })).toBeVisible();

    const cartRaw = await page.evaluate((key) => window.localStorage.getItem(key), CART_STORAGE_KEY);
    const itens = JSON.parse(cartRaw ?? "[]");
    expect(itens).toEqual([{ ...ITEM_VELA, quantidade: 4, estoqueConhecido: 2 }]);
  });

  test("\"-\" continua funcionando normalmente mesmo com o problema sinalizado", async ({
    page,
  }) => {
    await seedCart(page, [{ ...ITEM_VELA, quantidade: 4, estoqueConhecido: 2 }]);
    await page.goto(CARRINHO_URL);

    const linha = page.locator("ul.divide-y > li").filter({ hasText: "Vela Aromática Lavanda" });
    await linha.getByRole("button", { name: "Diminuir quantidade" }).click();

    await expect(linha.getByText("3", { exact: true })).toBeVisible();
  });

  // O CTA em si (chegar a /loja/checkout com sessão válida) já é coberto por
  // "Carrinho — CTA para checkout"; a validação real de estoque no momento
  // do checkout é responsabilidade do backend (fora do escopo desta etapa —
  // ver Checkout — Task 16 em e2e/checkout.spec.ts, "estoque insuficiente").
});

test.describe("Carrinho — CTA para checkout", () => {
  test("sem sessão: leva para /login preservando o retorno ao checkout", async ({ page }) => {
    await seedCart(page, [ITEM_VELA]);
    await page.goto(CARRINHO_URL);

    await page.getByRole("button", { name: "Ir para o checkout →" }).click();

    await expect(page).toHaveURL(/\/login\?redirect=%2Floja%2Fcheckout/);
  });

  test("com sessão válida: leva direto para /loja/checkout", async ({ page }) => {
    await seedSession(page);
    await seedCart(page, [ITEM_VELA]);
    await page.goto(CARRINHO_URL);

    await page.getByRole("button", { name: "Ir para o checkout →" }).click();

    await expect(page).toHaveURL(/\/loja\/checkout$/);
  });
});

test.describe("Carrinho — acessibilidade", () => {
  test("stepper e remoção são alcançáveis e ativáveis por teclado", async ({ page }) => {
    await seedCart(page, [ITEM_VELA]);
    await page.goto(CARRINHO_URL);

    const linha = page.locator("ul.divide-y > li").filter({ hasText: "Vela Aromática Lavanda" });
    const aumentar = linha.getByRole("button", { name: "Aumentar quantidade" });

    await aumentar.focus();
    await expect(aumentar).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(linha.getByText("3", { exact: true })).toBeVisible();

    const remover = page.getByRole("button", { name: 'Remover "Vela Aromática Lavanda" do carrinho' });
    await remover.focus();
    await expect(remover).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Ainda não há nada por aqui")).toBeVisible();
  });

  test("botões de toque (stepper e remover) têm pelo menos 44×44px", async ({ page }) => {
    await seedCart(page, [ITEM_VELA]);
    await page.goto(CARRINHO_URL);

    const linha = page.locator("ul.divide-y > li").filter({ hasText: "Vela Aromática Lavanda" });
    for (const nome of [
      "Aumentar quantidade",
      "Diminuir quantidade",
      'Remover "Vela Aromática Lavanda" do carrinho',
    ]) {
      const box = await linha.getByRole("button", { name: nome }).boundingBox();
      // Tolerância de sub-pixel (ex.: 43.999969...) por arredondamento de
      // renderização/DPI do browser — não é um alvo de toque real menor
      // que 44px, é o mesmo h-11 w-11 (44px) medido com ruído de ponto
      // flutuante.
      expect(box?.width).toBeGreaterThanOrEqual(43.9);
      expect(box?.height).toBeGreaterThanOrEqual(43.9);
    }
  });

  test("imagem do produto tem alt text", async ({ page }) => {
    await seedCart(page, [ITEM_VELA]);
    await page.goto(CARRINHO_URL);

    await expect(page.getByRole("img", { name: "Vela Aromática Lavanda" })).toBeVisible();
  });
});

test.describe("Carrinho — console e responsividade", () => {
  test("sem erros reais no console", async ({ page }) => {
    await seedCart(page, [ITEM_VELA, ITEM_SPRAY]);

    const erros: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") erros.push(msg.text());
    });
    page.on("pageerror", (err) => erros.push(err.message));

    await page.goto(CARRINHO_URL);
    await page.getByRole("button", { name: "Ir para o checkout →" }).waitFor();

    expect(erros).toEqual([]);
  });

  for (const { nome, width, height } of [
    { nome: "desktop 1440px", width: 1440, height: 900 },
    { nome: "tablet 768px", width: 768, height: 1024 },
    { nome: "mobile 390px", width: 390, height: 844 },
    { nome: "mobile 375px", width: 375, height: 812 },
  ]) {
    test(`sem overflow horizontal em ${nome} (com itens)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await seedCart(page, [ITEM_VELA, ITEM_SPRAY]);

      await page.goto(CARRINHO_URL);
      await page.getByRole("button", { name: "Ir para o checkout →" }).waitFor();

      expect(await hasHorizontalOverflow(page)).toBe(false);
    });

    test(`sem overflow horizontal em ${nome} (vazio)`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(CARRINHO_URL);
      await page.getByText("Ainda não há nada por aqui").waitFor();

      expect(await hasHorizontalOverflow(page)).toBe(false);
    });
  }
});

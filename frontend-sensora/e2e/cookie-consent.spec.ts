import { test, expect, type Page } from "@playwright/test";

// Aviso de cookies. Ele vem no HTML do servidor (para aparecer junto com a
// página, e não só depois de todo o JavaScript — era o LCP do PageSpeed
// mobile) e um script no <head> o esconde antes da primeira pintura quando já
// existe consentimento válido. Página estática (/faq): nenhuma chamada de API.

const CHAVE = "sensora_cookie_consent";
const PAGINA = "/faq";

const aviso = (page: Page) => page.getByRole("region", { name: "Consentimento de cookies" });

function consentimento(versao: number) {
  return JSON.stringify({
    version: versao,
    decidedAt: "2026-10-14T12:00:00.000Z",
    categories: { essential: true, analytics: false, marketing: false },
  });
}

async function semearConsentimento(page: Page, valor: string) {
  await page.addInitScript(
    ([chave, v]) => {
      // Só na primeira carga: a escolha feita no teste não é sobrescrita.
      if (!sessionStorage.getItem("semeado")) {
        localStorage.setItem(chave, v);
        sessionStorage.setItem("semeado", "1");
      }
    },
    [CHAVE, valor] as const,
  );
}

test.describe("Aviso de cookies", () => {
  test("primeira visita: o aviso vem no HTML do servidor e aparece", async ({ page, request }) => {
    const html = await (await request.get(PAGINA)).text();
    expect(html).toContain("data-cookie-banner");
    expect(html).toContain("Usamos cookies e armazenamento local");

    await page.goto(PAGINA);
    await expect(aviso(page)).toBeVisible();
  });

  test("recusar opcionais fecha, grava a escolha e o aviso não volta ao recarregar", async ({ page }) => {
    await page.goto(PAGINA);
    await aviso(page).getByRole("button", { name: "Recusar opcionais" }).click();
    await expect(aviso(page)).toHaveCount(0);

    const salvo = await page.evaluate((chave) => localStorage.getItem(chave), CHAVE);
    expect(JSON.parse(salvo ?? "{}")).toMatchObject({
      categories: { essential: true, analytics: false, marketing: false },
    });

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-cookie-consentido", "");
    await expect(aviso(page)).toHaveCount(0);
  });

  test("quem já consentiu não vê o aviso nem por um instante", async ({ page }) => {
    await semearConsentimento(page, consentimento(2));
    // Antes de qualquer JavaScript da página rodar (só o HTML e o script do
    // <head>), o aviso já está escondido pelo CSS.
    await page.goto(PAGINA, { waitUntil: "commit" });
    await page.waitForSelector("[data-cookie-banner]", { state: "attached" });
    const display = await page.evaluate(
      () => getComputedStyle(document.querySelector("[data-cookie-banner]")!).display,
    );
    expect(display).toBe("none");

    await page.waitForLoadState("load");
    await expect(aviso(page)).toHaveCount(0);
  });

  test("consentimento de versão antiga: o aviso aparece de novo", async ({ page }) => {
    await semearConsentimento(page, consentimento(1));
    await page.goto(PAGINA);
    await expect(page.locator("html")).not.toHaveAttribute("data-cookie-consentido", "");
    await expect(aviso(page)).toBeVisible();
  });

  test("com consentimento salvo, reabrir as preferências pelo rodapé funciona", async ({ page }) => {
    await semearConsentimento(page, consentimento(2));
    await page.goto(PAGINA);
    await expect(aviso(page)).toHaveCount(0);

    await page.getByRole("button", { name: "Preferências de cookies" }).click();
    await expect(page.getByRole("button", { name: "Salvar preferências" })).toBeVisible();
  });
});

import { test, expect, type Page } from "@playwright/test";

// Etapa 6.6 (Lote 2, Parte B) — regressão do bug de fuso horário
// identificado originalmente em /workspace-x/pedidos (Etapa 8.12, antes
// /admin/pedidos — PedidoTable.tsx) e também
// presente em /conta/pedidos e /conta/pedidos/[id]: `pedido.data` é meia-
// noite UTC; sem `timeZone: "UTC"` em toLocaleDateString, o navegador
// converte para o fuso local e pode exibir o dia anterior. Nenhuma suíte
// existente (conta-refinamento.spec.ts, conta-pedido-reembolso.spec.ts)
// tinha uma asserção sobre o valor exibido da data — só sobre navegação e
// sobre o fluxo de reembolso — por isso esta suíte nova, focada só nisso.

const TOKEN_KEY = "sensora_token";

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
}

// Meia-noite UTC — o caso exato que expunha o bug (America/Sao_Paulo é
// UTC-3, então sem a correção isto virava 31/08/2026 na tela).
const DATA_ISO = "2026-09-01T00:00:00.000Z";

const PEDIDO = {
  id: 7,
  numero: "PED-7",
  data: DATA_ISO,
  status: "PAGO",
  total: 119.8,
};

test.describe("Minha Conta / Pedidos — data correta (regressão do bug de fuso)", () => {
  test("/conta/pedidos (lista) exibe a data do pedido no fuso correto", async ({ page }) => {
    await seedSession(page);
    await page.route("**/pedidos/meus", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({ json: [PEDIDO] });
    });

    await page.goto("/conta/pedidos");

    await expect(page.getByText("01/09/2026")).toBeVisible();
    await expect(page.getByText("31/08/2026")).toHaveCount(0);
  });

  test("/conta/pedidos/[id] exibe a data do pedido (formato longo) no fuso correto", async ({ page }) => {
    await seedSession(page);
    await page.route(`**/pedidos/meus/${PEDIDO.id}`, async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({
        json: {
          pedido: PEDIDO,
          itens: [],
          total: PEDIDO.total,
        },
      });
    });

    await page.goto(`/conta/pedidos/${PEDIDO.id}`);

    await expect(page.getByRole("heading", { name: "01 de setembro de 2026" })).toBeVisible();
    await expect(page.getByText("31 de agosto de 2026")).toHaveCount(0);
  });
});

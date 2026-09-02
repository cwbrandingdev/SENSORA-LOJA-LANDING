import { test, expect, type Page } from "@playwright/test";

// Etapa 6.1 (Refinamento de Design — Minha Conta) — cobre especificamente o
// requisito obrigatório da etapa (navegação de volta consistente em todas
// as páginas internas) e as duas mudanças de UI de confirmação
// (window.confirm nativo -> ConfirmDialog) introduzidas em
// /conta/enderecos, além do novo mostrar/ocultar senha em /conta/seguranca.
// Mesmo padrão de mocks de e2e/checkout.spec.ts — sem backend real, toda
// chamada de API é interceptada via page.route.
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

const USUARIO = { id: 1, nome: "Cliente Sensora", email: "cliente@sensora.dev" };

async function mockMeuPerfil(page: Page) {
  await page.route("**/usuarios/me", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: USUARIO });
      return;
    }
    await route.continue();
  });
}

async function mockPedidosVazio(page: Page) {
  await page.route("**/pedidos/meus", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: [] });
      return;
    }
    await route.continue();
  });
}

const ENDERECO = {
  id: 10,
  usuarioId: 1,
  rua: "Rua das Flores",
  numero: "123",
  bairro: "Centro",
  cidade: "Curitiba",
  estado: "PR",
  cep: "80000-000",
  padrao: true,
};

// Escopado à origem exata da API (http://localhost:3000, ver .env.local),
// nunca "**/enderecos" puro: esse glob também bateria na navegação da
// própria página /conta/enderecos (mesmo sufixo de path), substituindo o
// HTML da página pelo JSON da resposta mockada.
async function mockEnderecosLista(page: Page, lista: unknown[]) {
  await page.route("http://localhost:3000/enderecos", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: lista });
      return;
    }
    await route.continue();
  });
}

test.describe("Navegação de volta (item 5/6 da Etapa 6.1)", () => {
  test("Dados pessoais volta para /conta", async ({ page }) => {
    await seedSession(page);
    await mockMeuPerfil(page);
    await page.goto("/conta/dados-pessoais");

    const back = page.getByRole("link", { name: "Voltar para Minha Conta" });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/conta");
  });

  test("Segurança volta para /conta", async ({ page }) => {
    await seedSession(page);
    await page.goto("/conta/seguranca");

    const back = page.getByRole("link", { name: "Voltar para Minha Conta" });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/conta");
  });

  test("Meus pedidos volta para /conta", async ({ page }) => {
    await seedSession(page);
    await mockPedidosVazio(page);
    await page.goto("/conta/pedidos");

    const back = page.getByRole("link", { name: "Voltar para Minha Conta" });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/conta");
  });

  test("Endereços volta para /conta", async ({ page }) => {
    await seedSession(page);
    await mockEnderecosLista(page, []);
    await page.goto("/conta/enderecos");

    const back = page.getByRole("link", { name: "Voltar para Minha Conta" });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/conta");
  });

  test("Detalhe do pedido volta para /conta/pedidos (não para /conta)", async ({ page }) => {
    await seedSession(page);
    await page.route("**/pedidos/meus/99", async (route) => {
      await route.fulfill({
        json: {
          pedido: {
            id: 99,
            numero: "PED-99",
            data: "2026-08-01T12:00:00.000Z",
            status: "PAGO",
            total: 59.9,
          },
          itens: [],
          total: 59.9,
        },
      });
    });
    await page.goto("/conta/pedidos/99");

    const back = page.getByRole("link", { name: "Voltar para Meus Pedidos" });
    await expect(back).toBeVisible();
    await expect(back).toHaveAttribute("href", "/conta/pedidos");
    // Visível mesmo antes/independente do conteúdo do pedido carregar —
    // nunca escondida atrás do estado de loading (item 19 da etapa).
    await expect(page.getByRole("link", { name: "Voltar para Minha Conta" })).toHaveCount(0);
  });
});

test.describe("Endereços — ConfirmDialog substitui window.confirm (Etapa 6.1)", () => {
  test("estado vazio mostra CTA único de cadastro (abre o formulário)", async ({ page }) => {
    await seedSession(page);
    await mockEnderecosLista(page, []);

    await page.goto("/conta/enderecos");

    await expect(page.getByText("Você ainda não possui endereços cadastrados")).toBeVisible();
    const botoesAdicionar = page.getByRole("button", { name: "+ Adicionar endereço" });
    await expect(botoesAdicionar).toHaveCount(1);
    await botoesAdicionar.click();

    await expect(page.getByRole("button", { name: "Salvar endereço" })).toBeVisible();
  });

  test("excluir endereço abre modal de confirmação (não o diálogo nativo) e remove ao confirmar", async ({
    page,
  }) => {
    await seedSession(page);
    let removido = false;
    await page.route("http://localhost:3000/enderecos", async (route) => {
      if (route.request().method() !== "GET") {
        await route.continue();
        return;
      }
      await route.fulfill({ json: removido ? [] : [ENDERECO] });
    });
    await page.route(`**/enderecos/${ENDERECO.id}`, async (route) => {
      if (route.request().method() === "DELETE") {
        removido = true;
        await route.fulfill({ status: 200 });
        return;
      }
      await route.continue();
    });

    let dialogNativoApareceu = false;
    page.on("dialog", (dialog) => {
      dialogNativoApareceu = true;
      dialog.dismiss();
    });

    await page.goto("/conta/enderecos");
    await page.getByRole("button", { name: "Excluir" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Remover endereço?")).toBeVisible();
    expect(dialogNativoApareceu).toBe(false);

    await dialog.getByRole("button", { name: "Remover endereço" }).click();

    await expect(page.getByText("Endereço removido com sucesso.")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(dialogNativoApareceu).toBe(false);
  });
});

test.describe("Segurança — mostrar/ocultar senha (Etapa 6.1)", () => {
  test("cada campo de senha alterna entre password e text de forma independente", async ({
    page,
  }) => {
    await seedSession(page);
    await page.goto("/conta/seguranca");
    await page.getByRole("button", { name: "Alterar senha" }).click();

    const senhaAtual = page.getByLabel("Senha atual", { exact: true });
    await expect(senhaAtual).toHaveAttribute("type", "password");

    await page.getByRole("button", { name: "Mostrar senha atual" }).click();
    await expect(senhaAtual).toHaveAttribute("type", "text");
    await expect(page.getByLabel("Nova senha", { exact: true })).toHaveAttribute(
      "type",
      "password",
    );

    await page.getByRole("button", { name: "Ocultar senha atual" }).click();
    await expect(senhaAtual).toHaveAttribute("type", "password");
  });
});

test.describe("Console — sem erros nas páginas refinadas", () => {
  for (const { nome, url, setup } of [
    {
      nome: "/conta",
      url: "/conta",
      setup: async () => {},
    },
    {
      nome: "/conta/dados-pessoais",
      url: "/conta/dados-pessoais",
      setup: mockMeuPerfil,
    },
    {
      nome: "/conta/seguranca",
      url: "/conta/seguranca",
      setup: async () => {},
    },
    {
      nome: "/conta/enderecos",
      url: "/conta/enderecos",
      setup: (page: Page) => mockEnderecosLista(page, [ENDERECO]),
    },
  ]) {
    test(`sem erros de console em ${nome}`, async ({ page }) => {
      await seedSession(page);
      await setup(page);

      const erros: string[] = [];
      page.on("console", (msg) => {
        if (msg.type() === "error") erros.push(msg.text());
      });
      page.on("pageerror", (err) => erros.push(err.message));

      await page.goto(url);
      await page.waitForLoadState("networkidle");

      expect(erros).toEqual([]);
    });
  }
});

// Item 19 da Etapa 6.1 (obrigatório) — mesma tolerância/técnica já usada em
// e2e/checkout.spec.ts (Navbar pré-existente produz ~12px de diferença
// legítima entre scrollWidth/innerWidth em toda página do site).
async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 24);
}

test.describe("Responsividade (item 19 da Etapa 6.1)", () => {
  const VIEWPORTS = [
    { nome: "desktop 1440px", width: 1440, height: 900 },
    { nome: "tablet 768px", width: 768, height: 1024 },
    { nome: "mobile 375px", width: 375, height: 812 },
  ];

  for (const { nome, width, height } of VIEWPORTS) {
    test(`/conta/pedidos (lista) sem overflow em ${nome}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await seedSession(page);
      await page.route("http://localhost:3000/pedidos/meus", async (route) => {
        await route.fulfill({
          json: [
            { id: 1, numero: "PED-1", data: "2026-08-01T12:00:00.000Z", status: "PAGO", total: 59.9 },
            {
              id: 2,
              numero: "PED-2",
              data: "2026-08-05T12:00:00.000Z",
              status: "REEMBOLSO_SOLICITADO",
              total: 119.8,
            },
          ],
        });
      });

      await page.goto("/conta/pedidos");
      await page.getByText("Pedido PED-1").waitFor();

      expect(await hasHorizontalOverflow(page)).toBe(false);
    });

    test(`/conta/pedidos/[id] (com modal de reembolso aberto) sem overflow em ${nome}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height });
      await seedSession(page);
      await page.route("http://localhost:3000/pedidos/meus/7", async (route) => {
        await route.fulfill({
          json: {
            pedido: { id: 7, numero: "PED-7", data: "2026-08-01T12:00:00.000Z", status: "PAGO", total: 59.9 },
            itens: [
              {
                id: 1,
                pedidoId: 7,
                produtoId: 101,
                produtoNome: "Vela Aromática Lavanda",
                produtoImagemUrl: null,
                quantidade: 1,
                precoUnitario: 59.9,
                subtotal: 59.9,
              },
            ],
            total: 59.9,
          },
        });
      });

      await page.goto("/conta/pedidos/7");
      await page.getByRole("button", { name: "Solicitar reembolso" }).click();

      await expect(page.getByRole("dialog")).toBeVisible();
      expect(await hasHorizontalOverflow(page)).toBe(false);
    });

    test(`/conta/enderecos sem overflow em ${nome}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await seedSession(page);
      await mockEnderecosLista(page, [ENDERECO]);

      await page.goto("/conta/enderecos");
      await page.getByText(ENDERECO.rua, { exact: false }).first().waitFor();

      expect(await hasHorizontalOverflow(page)).toBe(false);
    });
  }
});

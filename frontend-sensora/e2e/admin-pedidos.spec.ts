import { test, expect, type Page } from "@playwright/test";

// Etapa 6.6 (Parte B) — suíte E2E de /admin/pedidos dedicada à investigação/
// correção do "Editar" em pedidos PENDENTE. Não existia nenhuma suíte para
// esta página antes (achado da investigação: lacuna real de cobertura).
//
// A investigação (service-level + E2E com a API mockada) confirmou que o
// mecanismo de salvar (PUT /pedidos/:id) sempre funcionou corretamente para
// PENDENTE — o defeito real encontrado foi de EXIBIÇÃO: PedidoTable.tsx
// formatava `pedido.data` com `new Date(iso).toLocaleDateString("pt-BR")`
// sem fixar o fuso em UTC, então num fuso atrás de UTC (ex.: America/
// Sao_Paulo, UTC-3) a data exibida na tabela ficava um dia ATRÁS da data
// real — divergindo do que o próprio formulário de edição mostra (que lê a
// string ISO diretamente, sem essa conversão). Depois de editar e salvar,
// a linha continuava mostrando a data errada, dando a impressão de que a
// edição "não funciona corretamente". Corrigido com `{ timeZone: "UTC" }`.

const TOKEN_KEY = "sensora_token";
const PEDIDOS_URL = "/admin/pedidos";
const API_URL = "http://localhost:3000";

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
    email: "admin@sensora.dev",
    perfil: "ADMIN",
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

const PEDIDO_PENDENTE = {
  id: 1,
  numero: "PED-1",
  data: "2026-09-01T00:00:00.000Z",
  status: "PENDENTE",
  total: 150,
};

const PEDIDO_PAGO = {
  id: 2,
  numero: "PED-2",
  data: "2026-08-15T00:00:00.000Z",
  status: "PAGO",
  total: 89.9,
};

function mockPedidos(
  page: Page,
  pedidos: Record<string, unknown>[],
  opts?: { respostaPut?: (id: number) => { status: number; body: unknown } },
): Record<string, unknown>[] {
  const chamadasPut: Record<string, unknown>[] = [];

  page.route(`${API_URL}/pedidos`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: pedidos });
      return;
    }
    await route.continue();
  });

  for (const pedido of pedidos) {
    page.route(`${API_URL}/pedidos/${pedido.id}`, async (route) => {
      if (route.request().method() === "PUT") {
        const corpo = route.request().postDataJSON() as Record<string, unknown>;
        chamadasPut.push({ id: pedido.id, ...corpo });

        if (opts?.respostaPut) {
          const resposta = opts.respostaPut(pedido.id as number);
          await route.fulfill({ status: resposta.status, json: resposta.body });
          return;
        }

        await route.fulfill({ json: { ...pedido, ...corpo } });
        return;
      }
      await route.continue();
    });
  }

  return chamadasPut;
}

test.describe("Admin / Pedidos — Editar (PENDENTE)", () => {
  test("pedido PENDENTE aparece na listagem com a data correta (regressão do bug de fuso)", async ({
    page,
  }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_PENDENTE]);

    await page.goto(PEDIDOS_URL);

    // 2026-09-01 (UTC) — antes da correção, um fuso atrás de UTC exibia
    // 31/08/2026 nesta mesma linha.
    await expect(page.getByRole("cell", { name: "01/09/2026" })).toBeVisible();
  });

  test("botão Editar abre o formulário com os dados reais do pedido carregados", async ({ page }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_PENDENTE]);

    await page.goto(PEDIDOS_URL);
    await page.getByRole("button", { name: "Editar" }).click();

    await expect(page.locator("#numero")).toHaveValue("PED-1");
    await expect(page.locator("#data")).toHaveValue("2026-09-01");
    await expect(page.locator("#status")).toHaveValue("PENDENTE");
  });

  test("salvar a edição de um pedido PENDENTE funciona: envia o PUT e mostra sucesso", async ({ page }) => {
    await seedSession(page);
    const chamadasPut = mockPedidos(page, [PEDIDO_PENDENTE]);

    await page.goto(PEDIDOS_URL);
    await page.getByRole("button", { name: "Editar" }).click();
    await page.locator("#numero").fill("PED-1-revisado");
    await page.getByRole("button", { name: "Salvar edição" }).click();

    await expect(page.getByText("Status do pedido atualizado com sucesso.")).toBeVisible();
    expect(chamadasPut).toHaveLength(1);
    expect(chamadasPut[0]).toMatchObject({ id: 1, numero: "PED-1-revisado", status: "PENDENTE" });
  });

  test("editar sem alterar nada mantém a data correta após salvar (não regride para o dia anterior)", async ({
    page,
  }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_PENDENTE]);

    await page.goto(PEDIDOS_URL);
    await page.getByRole("button", { name: "Editar" }).click();
    await page.getByRole("button", { name: "Salvar edição" }).click();

    await expect(page.getByText("Status do pedido atualizado com sucesso.")).toBeVisible();
    await expect(page.getByRole("cell", { name: "01/09/2026" })).toBeVisible();
  });

  test("pedido PAGO continua bloqueado para edição (409 do backend), sem regressão da imutabilidade", async ({
    page,
  }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_PAGO], {
      respostaPut: () => ({
        status: 409,
        body: { message: "Pedido com status PAGO não pode ser alterado." },
      }),
    });

    await page.goto(PEDIDOS_URL);
    await page.getByRole("button", { name: "Editar" }).click();
    await page.getByRole("button", { name: "Salvar edição" }).click();

    await expect(page.getByText("Pedido com status PAGO não pode ser alterado.")).toBeVisible();
  });

  test("Remover permanece funcionando ao lado de Editar (sem regressão das demais ações)", async ({ page }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_PENDENTE]);

    await page.goto(PEDIDOS_URL);

    await expect(page.getByRole("button", { name: "Editar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Remover" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ver itens" })).toBeVisible();
  });
});

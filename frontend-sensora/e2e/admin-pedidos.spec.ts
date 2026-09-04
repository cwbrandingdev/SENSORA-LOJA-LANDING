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
  statusEnvio: "NAO_ENVIADO",
  total: 150,
};

const PEDIDO_PAGO = {
  id: 2,
  numero: "PED-2",
  data: "2026-08-15T00:00:00.000Z",
  status: "PAGO",
  statusEnvio: "NAO_ENVIADO",
  total: 89.9,
};

// Etapa 8.2 (HIGH-02 — exclusão de pedidos) — fixtures para os demais
// status que nunca podem ser excluídos, além de PAGO acima.
const PEDIDO_REEMBOLSO_SOLICITADO = {
  id: 4,
  numero: "PED-4",
  data: "2026-08-10T00:00:00.000Z",
  status: "REEMBOLSO_SOLICITADO",
  statusEnvio: "NAO_ENVIADO",
  total: 59.9,
};

const PEDIDO_REEMBOLSADO = {
  id: 5,
  numero: "PED-5",
  data: "2026-08-05T00:00:00.000Z",
  status: "REEMBOLSADO",
  statusEnvio: "NAO_ENVIADO",
  total: 69.9,
};

const PEDIDO_CANCELADO = {
  id: 6,
  numero: "PED-6",
  data: "2026-08-01T00:00:00.000Z",
  status: "CANCELADO",
  statusEnvio: "NAO_ENVIADO",
  total: 79.9,
};

function mockPedidos(
  page: Page,
  pedidos: Record<string, unknown>[],
  opts?: {
    respostaPut?: (id: number) => { status: number; body: unknown };
    respostaMarcarEnviado?: (id: number) => { status: number; body: unknown; delayMs?: number };
    respostaDelete?: (id: number) => { status: number; body: unknown };
  },
): {
  chamadasPut: Record<string, unknown>[];
  chamadasMarcarEnviado: number[];
  chamadasDelete: number[];
} {
  const chamadasPut: Record<string, unknown>[] = [];
  const chamadasMarcarEnviado: number[] = [];
  const chamadasDelete: number[] = [];

  // Etapa 8.2 — clona cada fixture em vez de reaproveitar a referência do
  // `const` compartilhado no módulo (PEDIDO_PAGO etc.): os handlers abaixo
  // mutam (`Object.assign`) ou removem (`splice`, delete) o pedido para
  // simular o comportamento real do backend entre chamadas dentro do MESMO
  // teste — mutar a fixture original vazaria estado entre testes que rodam
  // no mesmo worker (achado desta etapa: "cancelar a confirmação nativa"
  // de Marcar como Enviado ficava intermitente porque um teste anterior no
  // mesmo worker já tinha sobrescrito `PEDIDO_PAGO.statusEnvio` para
  // "ENVIADO" via essa mesma mutação).
  const pedidosInternos = pedidos.map((pedido) => ({ ...pedido }));

  page.route(`${API_URL}/pedidos`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: pedidosInternos });
      return;
    }
    await route.continue();
  });

  for (const pedido of pedidosInternos) {
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

      // Etapa 8.2 (HIGH-02) — DELETE /pedidos/:id, mesma rota já mockada
      // acima para PUT (Playwright faz match por método dentro da mesma
      // rota registrada).
      if (route.request().method() === "DELETE") {
        chamadasDelete.push(pedido.id as number);

        if (opts?.respostaDelete) {
          const resposta = opts.respostaDelete(pedido.id as number);
          await route.fulfill({ status: resposta.status, json: resposta.body });
          return;
        }

        // Remove de `pedidosInternos` (não da fixture original) — a
        // próxima listagem (carregarPedidos(), depois do sucesso) reflete
        // a exclusão, exatamente como o backend real faria.
        const indice = pedidosInternos.findIndex((p) => p.id === pedido.id);
        if (indice !== -1) pedidosInternos.splice(indice, 1);

        await route.fulfill({ status: 204, body: "" });
        return;
      }

      await route.continue();
    });

    // Etapa 6.6 (Status de Envio) — POST /pedidos/:id/marcar-enviado, rota
    // separada da acima (Playwright faz match exato de URL sem wildcard, não
    // colide com `${API_URL}/pedidos/${id}`).
    page.route(`${API_URL}/pedidos/${pedido.id}/marcar-enviado`, async (route) => {
      if (route.request().method() !== "POST") {
        await route.continue();
        return;
      }

      chamadasMarcarEnviado.push(pedido.id as number);

      if (opts?.respostaMarcarEnviado) {
        const resposta = opts.respostaMarcarEnviado(pedido.id as number);
        if (resposta.delayMs) {
          await new Promise((resolve) => setTimeout(resolve, resposta.delayMs));
        }
        await route.fulfill({ status: resposta.status, json: resposta.body });
        return;
      }

      // Muta o próprio objeto (não cria um novo) — o GET /pedidos acima lê
      // a mesma referência, então a próxima listagem (carregarPedidos() do
      // admin, depois do sucesso) já reflete ENVIADO/enviadoEm, exatamente
      // como o backend real faria.
      Object.assign(pedido, { statusEnvio: "ENVIADO", enviadoEm: "2026-09-03T15:30:00.000Z" });
      await route.fulfill({ json: pedido });
    });
  }

  return { chamadasPut, chamadasMarcarEnviado, chamadasDelete };
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
  });

  // Etapa 8.1 (HIGH-01 — fechamento da venda manual): o formulário de
  // pedido não tem mais campo de status (achado da auditoria — CRUD
  // administrativo não pode fabricar PAGO). Este teste substitui a antiga
  // asserção "campo #status existe" — cobria comportamento inseguro que foi
  // deliberadamente removido, não uma regressão.
  test("formulário de edição não expõe nenhum campo de status (não é possível fabricar PAGO pelo CRUD)", async ({
    page,
  }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_PENDENTE]);

    await page.goto(PEDIDOS_URL);
    await page.getByRole("button", { name: "Editar" }).click();

    await expect(page.locator("#status")).toHaveCount(0);
  });

  test("salvar a edição de um pedido PENDENTE funciona: envia o PUT (sem status) e mostra sucesso", async ({ page }) => {
    await seedSession(page);
    const { chamadasPut } = mockPedidos(page, [PEDIDO_PENDENTE]);

    await page.goto(PEDIDOS_URL);
    await page.getByRole("button", { name: "Editar" }).click();
    await page.locator("#numero").fill("PED-1-revisado");
    await page.getByRole("button", { name: "Salvar edição" }).click();

    await expect(page.getByText("Pedido atualizado com sucesso.")).toBeVisible();
    expect(chamadasPut).toHaveLength(1);
    expect(chamadasPut[0]).toMatchObject({ id: 1, numero: "PED-1-revisado" });
    // Etapa 8.1 — nunca envia status, mesmo que o pedido editado seja
    // PENDENTE: o CRUD administrativo não é mais capaz de expressar uma
    // transição de status, PAGO incluso.
    expect(chamadasPut[0]).not.toHaveProperty("status");
  });

  test("editar sem alterar nada mantém a data correta após salvar (não regride para o dia anterior)", async ({
    page,
  }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_PENDENTE]);

    await page.goto(PEDIDOS_URL);
    await page.getByRole("button", { name: "Editar" }).click();
    await page.getByRole("button", { name: "Salvar edição" }).click();

    await expect(page.getByText("Pedido atualizado com sucesso.")).toBeVisible();
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

  // Etapa 8.1 (complemento — eliminação da venda manual): a página não
  // oferece mais nenhuma forma de criar um pedido pela área administrativa
  // — "Novo pedido" foi removido de propósito (achado da revisão: manter o
  // botão, mesmo sem POST /pedidos no backend, seria oferecer uma ação que
  // sempre falharia).
  test("não existe mais o botão 'Novo pedido' — criação administrativa de venda foi removida", async ({ page }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_PENDENTE]);

    await page.goto(PEDIDOS_URL);

    await expect(page.getByRole("button", { name: "Novo pedido" })).toHaveCount(0);
  });
});

// Etapa 8.2 (HIGH-02 — "Admin order CRUD can hard-delete financially
// relevant orders") — suíte E2E dedicada à exclusão de pedidos: prova que
// o botão "Remover" só aparece para PENDENTE (a proteção real é sempre do
// backend, ver pedidos.service.spec.ts — isto é só a UI refletindo a
// mesma regra) e que o fluxo funcional de exclusão continua funcionando
// para PENDENTE.
test.describe("Admin / Pedidos — Exclusão (Etapa 8.2, HIGH-02)", () => {
  test("PENDENTE: botão 'Remover' está visível", async ({ page }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_PENDENTE]);

    await page.goto(PEDIDOS_URL);

    await expect(page.getByRole("button", { name: "Remover" })).toBeVisible();
  });

  test("PENDENTE: clicar em Remover chama DELETE /pedidos/:id, mostra sucesso e remove a linha", async ({
    page,
  }) => {
    await seedSession(page);
    const { chamadasDelete } = mockPedidos(page, [PEDIDO_PENDENTE]);

    await page.goto(PEDIDOS_URL);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Remover" }).click();

    await expect(page.getByText("Pedido excluído com sucesso.")).toBeVisible();
    expect(chamadasDelete).toEqual([1]);
    await expect(page.getByText("Nenhum pedido cadastrado")).toBeVisible();
  });

  test("PENDENTE: cancelar a confirmação nativa não chama o endpoint", async ({ page }) => {
    await seedSession(page);
    const { chamadasDelete } = mockPedidos(page, [PEDIDO_PENDENTE]);

    await page.goto(PEDIDOS_URL);
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Remover" }).click();

    expect(chamadasDelete).toEqual([]);
    await expect(page.getByRole("button", { name: "Remover" })).toBeVisible();
  });

  test("PAGO: botão 'Remover' não é oferecido", async ({ page }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_PAGO]);

    await page.goto(PEDIDOS_URL);

    await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(0);
  });

  test("REEMBOLSO_SOLICITADO: botão 'Remover' não é oferecido", async ({ page }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_REEMBOLSO_SOLICITADO]);

    await page.goto(PEDIDOS_URL);

    await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(0);
  });

  test("REEMBOLSADO: botão 'Remover' não é oferecido", async ({ page }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_REEMBOLSADO]);

    await page.goto(PEDIDOS_URL);

    await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(0);
  });

  test("CANCELADO: botão 'Remover' não é oferecido", async ({ page }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_CANCELADO]);

    await page.goto(PEDIDOS_URL);

    await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(0);
  });

  // Defesa em profundidade: mesmo que o botão seja escondido pela UI, uma
  // chamada direta a DELETE /pedidos/:id para um pedido protegido precisa
  // continuar sendo rejeitada pelo backend (409) — este teste simula essa
  // chamada via a API mockada (não passa pela UI, que nem oferece o botão)
  // para provar que a mensagem de erro do backend seria exibida
  // corretamente se, por algum motivo, a chamada acontecesse mesmo assim.
  test("PAGO: uma chamada direta a DELETE (contornando a UI) mostra o erro 409 do backend, nunca finge sucesso", async ({
    page,
  }) => {
    await seedSession(page);
    const { chamadasDelete } = mockPedidos(page, [PEDIDO_PAGO], {
      respostaDelete: () => ({
        status: 409,
        body: { message: "Pedido com status PAGO não pode ser excluído." },
      }),
    });

    await page.goto(PEDIDOS_URL);
    const resposta = await page.evaluate(async () => {
      const token = window.localStorage.getItem("sensora_token");
      const res = await fetch("http://localhost:3000/pedidos/2", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      return { status: res.status, body: await res.json() };
    });

    expect(resposta.status).toBe(409);
    expect(resposta.body.message).toBe("Pedido com status PAGO não pode ser excluído.");
    expect(chamadasDelete).toEqual([2]);
  });
});

// Etapa 6.6 (Status de Envio) — suíte E2E de /admin/pedidos dedicada à ação
// "Marcar como enviado" (POST /pedidos/:id/marcar-enviado) e à nova coluna
// "Envio". Não duplica as regras de negócio (só a partir de PAGO,
// idempotência, claim atômico) — isso já está coberto no
// pedidos.service.spec.ts do backend; aqui o foco é a interação real do
// admin com o botão e o feedback visual.
const PEDIDO_PAGO_ENVIADO = {
  id: 3,
  numero: "PED-3",
  data: "2026-08-20T00:00:00.000Z",
  status: "PAGO",
  statusEnvio: "ENVIADO",
  enviadoEm: "2026-08-21T14:00:00.000Z",
  total: 199.9,
};

test.describe("Admin / Pedidos — Status de Envio", () => {
  test("pedido PAGO + NAO_ENVIADO aparece como 'Aguardando envio', com o botão visível", async ({
    page,
  }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_PAGO]);

    await page.goto(PEDIDOS_URL);

    await expect(page.getByText("Aguardando envio")).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar como enviado" })).toBeVisible();
  });

  test("pedido PENDENTE não mostra o botão 'Marcar como enviado'", async ({ page }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_PENDENTE]);

    await page.goto(PEDIDOS_URL);

    await expect(page.getByRole("button", { name: "Marcar como enviado" })).toHaveCount(0);
  });

  test("clicar em 'Marcar como enviado' chama o endpoint e, após sucesso, mostra ENVIADO com a data — o botão some", async ({
    page,
  }) => {
    await seedSession(page);
    const { chamadasMarcarEnviado } = mockPedidos(page, [PEDIDO_PAGO]);

    await page.goto(PEDIDOS_URL);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Marcar como enviado" }).click();

    await expect(page.getByText("Pedido marcado como enviado.")).toBeVisible();
    expect(chamadasMarcarEnviado).toEqual([2]);

    // A tabela recarrega do backend (mock devolve statusEnvio: ENVIADO +
    // enviadoEm) — reflete ENVIADO, a data e o botão desaparece.
    await expect(page.getByText("Enviado", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar como enviado" })).toHaveCount(0);
  });

  test("loading: o botão mostra 'Marcando...' e fica desabilitado durante a chamada, impedindo clique duplicado", async ({
    page,
  }) => {
    await seedSession(page);
    const { chamadasMarcarEnviado } = mockPedidos(page, [PEDIDO_PAGO], {
      respostaMarcarEnviado: (id) => ({
        status: 200,
        delayMs: 300,
        body: { ...PEDIDO_PAGO, id, statusEnvio: "ENVIADO", enviadoEm: "2026-09-03T15:30:00.000Z" },
      }),
    });

    await page.goto(PEDIDOS_URL);
    page.once("dialog", (dialog) => dialog.accept());
    const botao = page.getByRole("button", { name: "Marcar como enviado" });
    await botao.click();

    await expect(page.getByRole("button", { name: "Marcando..." })).toBeDisabled();

    await expect(page.getByText("Pedido marcado como enviado.")).toBeVisible();
    expect(chamadasMarcarEnviado).toHaveLength(1);
  });

  test("pedido já ENVIADO mostra a data de envio e não oferece o botão de novo", async ({ page }) => {
    await seedSession(page);
    mockPedidos(page, [PEDIDO_PAGO_ENVIADO]);

    await page.goto(PEDIDOS_URL);

    await expect(page.getByText("Enviado", { exact: true })).toBeVisible();
    // enviadoEm "2026-08-21T14:00:00.000Z" em America/Sao_Paulo (UTC-3) é
    // ainda 21/08 (11h da manhã) — sem risco de virar o dia errado aqui,
    // mas a formatação usa explicitamente esse fuso (ver PedidoTable.tsx).
    await expect(page.getByText("21/08/2026")).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar como enviado" })).toHaveCount(0);
  });

  test("cancelar a confirmação nativa não chama o endpoint", async ({ page }) => {
    await seedSession(page);
    const { chamadasMarcarEnviado } = mockPedidos(page, [PEDIDO_PAGO]);

    await page.goto(PEDIDOS_URL);
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("button", { name: "Marcar como enviado" }).click();

    expect(chamadasMarcarEnviado).toEqual([]);
    await expect(page.getByText("Aguardando envio")).toBeVisible();
  });
});

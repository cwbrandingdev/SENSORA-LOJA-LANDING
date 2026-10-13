import { test, expect, type Page, type Route } from "@playwright/test";

// Solicitações de suporte no Workspace-X (/workspace-x/suporte e
// /workspace-x/suporte/[id]). A API é simulada via page.route pelo CAMINHO
// da URL (o host da API vem do .env do app, que o Playwright não lê). Tudo
// que não for o servidor local é bloqueado: nenhum teste daqui pode
// alcançar uma API real.

const TOKEN_KEY = "sensora_token";
const LISTA_URL = "/workspace-x/suporte";
const DETALHE_URL = "/workspace-x/suporte/1";

// A API fica em outra origem: a resposta simulada precisa liberar o CORS.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
};

test.beforeEach(async ({ page }) => {
  await page.route(
    (url) => url.hostname !== "localhost",
    (route) => route.abort(),
  );
});

function base64Url(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fakeToken(perfil: "ADMIN" | "VENDEDOR"): string {
  const header = base64Url({ alg: "HS256", typ: "JWT" });
  const payload = base64Url({
    sub: 1,
    email: "admin@sensora.dev",
    perfil,
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.assinatura-fake`;
}

async function seedSession(page: Page, perfil: "ADMIN" | "VENDEDOR" = "ADMIN") {
  await page.addInitScript(
    ([tokenKey, token]) => {
      window.localStorage.setItem(tokenKey, token);
    },
    [TOKEN_KEY, fakeToken(perfil)] as const,
  );
}

type Solicitacao = {
  id: number;
  usuarioId: number;
  nome: string;
  email: string;
  categoria: string;
  assunto: string;
  mensagem: string;
  status: "ABERTA" | "EM_ATENDIMENTO" | "RESOLVIDA";
  criadaEm: string;
  atualizadaEm: string;
};

function solicitacao(extras: Partial<Solicitacao> & { id: number }): Solicitacao {
  return {
    usuarioId: 7,
    nome: "Ana Cliente",
    email: "ana@sensora.dev",
    categoria: "PEDIDO_ENTREGA",
    assunto: `Assunto ${extras.id}`,
    mensagem: "Meu pedido não chegou.\nPodem verificar?",
    status: "ABERTA",
    criadaEm: "2026-10-13T15:00:00.000Z",
    atualizadaEm: "2026-10-13T15:00:00.000Z",
    ...extras,
  };
}

const BASE = [
  solicitacao({ id: 1, assunto: "Pedido atrasado" }),
  solicitacao({
    id: 2,
    assunto: "Troca de aroma",
    nome: "Bruno",
    email: "bruno@sensora.dev",
    categoria: "PAGAMENTO",
    status: "RESOLVIDA",
  }),
];

// Item da lista: sem mensagem nem usuarioId (como o backend).
function resumo(s: Solicitacao) {
  return {
    id: s.id,
    nome: s.nome,
    email: s.email,
    categoria: s.categoria,
    assunto: s.assunto,
    status: s.status,
    criadaEm: s.criadaEm,
    atualizadaEm: s.atualizadaEm,
  };
}

async function responder(route: Route, status: number, json: unknown) {
  await route.fulfill({ status, headers: CORS, json });
}

// GET /admin/suporte(?status=&page=), GET /admin/suporte/:id e
// PATCH /admin/suporte/:id/status, com estado. `porPagina` simula a
// paginação do backend; com `erroLista`, a lista responde 500 até o teste
// trocar `chamadas.erroLista` (o modo dev pode carregar a lista duas vezes).
async function mockSuporte(
  page: Page,
  options: {
    solicitacoes?: Solicitacao[];
    porPagina?: number;
    erroLista?: boolean;
  } = {},
): Promise<{
  consultas: { status: string | null; categoria: string | null; page: string | null }[];
  mudancas: unknown[];
  erroLista: boolean;
}> {
  const banco = (options.solicitacoes ?? BASE).map((s) => ({ ...s }));
  const porPagina = options.porPagina ?? 20;
  const chamadas = {
    consultas: [] as { status: string | null; categoria: string | null; page: string | null }[],
    mudancas: [] as unknown[],
    erroLista: options.erroLista ?? false,
  };

  await page.route(
    (url) => url.pathname.startsWith("/admin/suporte"),
    async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() === "OPTIONS") {
        await route.fulfill({ status: 204, headers: CORS });
        return;
      }

      if (url.pathname === "/admin/suporte" && request.method() === "GET") {
        const status = url.searchParams.get("status");
        const categoria = url.searchParams.get("categoria");
        const pagina = Number(url.searchParams.get("page") ?? 1);
        chamadas.consultas.push({ status, categoria, page: url.searchParams.get("page") });
        if (chamadas.erroLista) {
          await responder(route, 500, { message: "Internal server error" });
          return;
        }
        const filtradas = banco.filter(
          (s) => (!status || s.status === status) && (!categoria || s.categoria === categoria),
        );
        await responder(route, 200, {
          items: filtradas.slice((pagina - 1) * porPagina, pagina * porPagina).map(resumo),
          page: pagina,
          pageSize: porPagina,
          total: filtradas.length,
          totalPages: Math.ceil(filtradas.length / porPagina),
        });
        return;
      }

      const detalhe = url.pathname.match(/^\/admin\/suporte\/(\d+)(\/status)?$/);
      const registro = detalhe ? banco.find((s) => s.id === Number(detalhe[1])) : undefined;
      if (!registro) {
        await responder(route, 404, { message: "Solicitação de suporte não encontrada." });
        return;
      }
      if (detalhe?.[2] && request.method() === "PATCH") {
        const corpo = request.postDataJSON() as { status: Solicitacao["status"] };
        chamadas.mudancas.push(corpo);
        registro.status = corpo.status;
        registro.atualizadaEm = "2026-10-13T16:30:00.000Z";
      }
      await responder(route, 200, registro);
    },
  );
  return chamadas;
}

const menu = (page: Page) =>
  page.getByRole("navigation", { name: "Navegação administrativa" });

test.describe("Admin — Suporte", () => {
  test("ADMIN vê Suporte no menu e o quadro: cada solicitação na coluna do seu status", async ({
    page,
  }) => {
    await seedSession(page);
    const chamadas = await mockSuporte(page);

    await page.goto(LISTA_URL);

    await expect(menu(page).getByRole("link", { name: "Suporte" })).toBeVisible();
    const aberta = page.getByRole("region", { name: "Aberta" });
    const cartao = aberta.getByRole("link", { name: /Pedido atrasado/ });
    await expect(cartao).toContainText("Pedido e entrega");
    await expect(cartao).toContainText("12:00");
    await expect(cartao).toContainText("Ana Cliente");
    await expect(
      page.getByRole("region", { name: "Resolvida" }).getByRole("link", { name: /Troca de aroma/ }),
    ).toBeVisible();
    await expect(page.getByRole("region", { name: "Em atendimento" })).toContainText(
      "Nada por aqui.",
    );
    expect(chamadas.consultas[0]).toEqual({ status: null, categoria: null, page: "1" });
  });

  test("clicar no título da coluna filtra pelo status; dá para voltar a todas", async ({
    page,
  }) => {
    await seedSession(page);
    const chamadas = await mockSuporte(page);

    await page.goto(LISTA_URL);
    await expect(page.getByRole("link", { name: /Pedido atrasado/ })).toBeVisible();
    await page.getByRole("button", { name: "Resolvida" }).click();

    await expect(page.getByRole("link", { name: /Troca de aroma/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Pedido atrasado/ })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "Aberta" })).toHaveCount(0);
    expect(chamadas.consultas.at(-1)).toEqual({ status: "RESOLVIDA", categoria: null, page: "1" });

    await page.getByRole("button", { name: "Mostrar todas as colunas" }).click();
    await expect(page.getByRole("link", { name: /Pedido atrasado/ })).toBeVisible();
    expect(chamadas.consultas.at(-1)).toEqual({ status: null, categoria: null, page: "1" });
  });

  test("filtro por categoria pede ao backend e mostra só as da categoria", async ({ page }) => {
    await seedSession(page);
    const chamadas = await mockSuporte(page);

    await page.goto(LISTA_URL);
    await expect(page.getByRole("link", { name: "Pedido atrasado" })).toBeVisible();
    await page.getByLabel("Categoria").selectOption("PAGAMENTO");

    await expect(page.getByRole("link", { name: "Troca de aroma" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pedido atrasado" })).toHaveCount(0);
    expect(chamadas.consultas.at(-1)).toEqual({ status: null, categoria: "PAGAMENTO", page: "1" });
  });

  test("filtro sem resultado mostra o estado vazio", async ({ page }) => {
    await seedSession(page);
    await mockSuporte(page);

    await page.goto(LISTA_URL);
    await page.getByLabel("Categoria").selectOption("CONTA");

    await expect(page.getByText("Nenhuma solicitação com estes filtros.")).toBeVisible();
  });

  test("paginação pede a próxima página ao backend", async ({ page }) => {
    await seedSession(page);
    const chamadas = await mockSuporte(page, {
      solicitacoes: [
        solicitacao({ id: 1, assunto: "Primeira" }),
        solicitacao({ id: 2, assunto: "Segunda" }),
        solicitacao({ id: 3, assunto: "Terceira" }),
      ],
      porPagina: 2,
    });

    await page.goto(LISTA_URL);
    await expect(page.getByText("Página 1 de 2 · 3 solicitações")).toBeVisible();
    await page.getByRole("button", { name: "Próxima" }).click();

    await expect(page.getByRole("link", { name: "Terceira" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Primeira" })).toHaveCount(0);
    expect(chamadas.consultas.at(-1)).toEqual({ status: null, categoria: null, page: "2" });
  });

  test("erro ao carregar mostra a mensagem e Tentar novamente recarrega", async ({ page }) => {
    await seedSession(page);
    const chamadas = await mockSuporte(page, { erroLista: true });

    await page.goto(LISTA_URL);
    await expect(page.getByText("Não foi possível carregar as solicitações.")).toBeVisible();
    chamadas.erroLista = false;
    await page.getByRole("button", { name: /Tentar novamente/ }).click();

    await expect(page.getByRole("link", { name: "Pedido atrasado" })).toBeVisible();
  });

  test("abre o detalhe com a mensagem e o link para responder por e-mail", async ({ page }) => {
    await seedSession(page);
    await mockSuporte(page);

    await page.goto(LISTA_URL);
    await page.getByRole("link", { name: "Pedido atrasado" }).click();

    await expect(page).toHaveURL(/\/workspace-x\/suporte\/1$/);
    await expect(page.getByRole("heading", { name: "Solicitação #1" })).toBeVisible();
    await expect(page.getByText("Meu pedido não chegou.")).toBeVisible();
    await expect(page.getByText("Pedido e entrega")).toBeVisible();
    await expect(page.getByRole("link", { name: "Responder por e-mail" })).toHaveAttribute(
      "href",
      "mailto:ana@sensora.dev?subject=Re%3A%20Pedido%20atrasado",
    );
  });

  test("clicar em qualquer parte do cartão (ex.: nome do cliente) abre o detalhe", async ({
    page,
  }) => {
    await seedSession(page);
    await mockSuporte(page);

    await page.goto(LISTA_URL);
    await page.getByRole("link", { name: /Pedido atrasado/ }).getByText("Ana Cliente").click();

    await expect(page).toHaveURL(/\/workspace-x\/suporte\/1$/);
    await expect(page.getByRole("heading", { name: "Solicitação #1" })).toBeVisible();
  });

  test("muda o status: confirma, envia ao backend e atualiza a tela", async ({ page }) => {
    await seedSession(page);
    const chamadas = await mockSuporte(page);

    await page.goto(DETALHE_URL);
    await page.getByRole("button", { name: "Marcar em atendimento" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();

    await expect(page.getByText("Em atendimento", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Marcar em atendimento" })).toHaveCount(0);
    expect(chamadas.mudancas).toEqual([{ status: "EM_ATENDIMENTO" }]);

    await page.getByRole("button", { name: "Marcar como resolvida" }).click();
    await page.getByRole("button", { name: "Confirmar" }).click();

    await expect(page.getByText("Resolvida", { exact: true })).toBeVisible();
    expect(chamadas.mudancas).toEqual([{ status: "EM_ATENDIMENTO" }, { status: "RESOLVIDA" }]);
  });

  test("cancelar a confirmação não muda nada", async ({ page }) => {
    await seedSession(page);
    const chamadas = await mockSuporte(page);

    await page.goto(DETALHE_URL);
    await page.getByRole("button", { name: "Marcar como resolvida" }).click();
    await page.getByRole("button", { name: "Voltar" }).click();

    await expect(page.getByText("Aberta", { exact: true })).toBeVisible();
    expect(chamadas.mudancas).toHaveLength(0);
  });

  test("solicitação inexistente mostra não encontrada", async ({ page }) => {
    await seedSession(page);
    await mockSuporte(page);

    await page.goto("/workspace-x/suporte/99");

    await expect(page.getByText("Solicitação não encontrada")).toBeVisible();
  });

  test("VENDEDOR não vê Suporte no menu e as páginas não carregam dados", async ({ page }) => {
    await seedSession(page, "VENDEDOR");
    const chamadas = await mockSuporte(page);

    await page.goto(LISTA_URL);
    await expect(page.getByText("Acesso restrito a administradores.")).toBeVisible();
    await expect(menu(page).getByRole("link", { name: "Suporte" })).toHaveCount(0);

    await page.goto(DETALHE_URL);
    await expect(page.getByText("Acesso restrito a administradores.")).toBeVisible();

    expect(chamadas.consultas).toHaveLength(0);
  });
});

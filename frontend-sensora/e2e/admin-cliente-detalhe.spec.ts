import { test, expect, type Page } from "@playwright/test";

// Fase B (Admin/Clientes reais) — cobertura mínima de
// /workspace-x/clientes/[id] (backend: GET /usuarios/:id/detalhes, ver
// UsuariosService.buscarDetalheCliente). Mesmo padrão de mock via
// page.route já usado em e2e/admin-pedido-detalhe.spec.ts — não reabre
// nenhuma suíte do CRUD legado de /workspace-x/clientes (model Cliente,
// intocado nesta etapa) nem duplica a suíte do detalhe de pedido.

const TOKEN_KEY = "sensora_token";
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

const CLIENTE_COMPLETO = {
  id: 7,
  nome: "Maria Cliente",
  email: "maria@sensora.dev",
  cpf: "52998224725",
  telefone: "41999999999",
  ativo: true,
  emailVerificado: true,
  enderecos: [
    {
      id: 1,
      usuarioId: 7,
      rua: "Rua das Flores",
      numero: "123",
      complemento: null,
      bairro: "Centro",
      cidade: "Curitiba",
      estado: "PR",
      cep: "80000-000",
      padrao: true,
    },
  ],
  pedidos: [
    {
      id: 42,
      numero: "PED-42",
      data: "2026-09-01T00:00:00.000Z",
      status: "PAGO",
      total: 99.9,
    },
  ],
  resumo: {
    quantidadePedidos: 1,
    totalComprado: 99.9,
    ultimoPedidoEm: "2026-09-01T00:00:00.000Z",
  },
};

const CLIENTE_SEM_HISTORICO = {
  id: 8,
  nome: "João Sem Pedido",
  email: "joao@sensora.dev",
  cpf: null,
  telefone: null,
  ativo: false,
  emailVerificado: false,
  enderecos: [],
  pedidos: [],
  resumo: { quantidadePedidos: 0, totalComprado: 0, ultimoPedidoEm: null },
};

function mockDetalheCliente(page: Page, id: number, resposta: { status: number; body: unknown }) {
  page.route(`${API_URL}/usuarios/${id}/detalhes`, async (route) => {
    await route.fulfill({ status: resposta.status, json: resposta.body });
  });
}

test.describe("Admin / Cliente detalhe (Fase A — Clientes reais)", () => {
  test("cliente com histórico: exibe dados cadastrais, CPF/telefone formatados, endereço, resumo e pedido com link", async ({
    page,
  }) => {
    await seedSession(page);
    mockDetalheCliente(page, CLIENTE_COMPLETO.id, { status: 200, body: CLIENTE_COMPLETO });

    await page.goto(`/workspace-x/clientes/${CLIENTE_COMPLETO.id}`);

    await expect(page.getByRole("heading", { name: CLIENTE_COMPLETO.nome })).toBeVisible();
    await expect(page.getByText(CLIENTE_COMPLETO.email)).toBeVisible();
    await expect(page.getByText("Ativo", { exact: true })).toBeVisible();
    // formatarCpf/formatarTelefone (lib/cpf.ts, lib/telefone.ts) — nunca o
    // dígito cru salvo no banco.
    await expect(page.getByText("529.982.247-25")).toBeVisible();
    await expect(page.getByText("(41) 99999-9999")).toBeVisible();

    // Resumo de pedidos (MetricCard) — quantidade, total comprado (só PAGO)
    // e último pedido, todos vindos prontos do backend, nunca recalculados
    // no client. `.first()` porque o mesmo valor formatado também aparece
    // na coluna Total da tabela de pedidos logo abaixo (mesmo pedido único
    // no fixture) — ambos são o comportamento esperado, não uma duplicata
    // acidental.
    await expect(page.getByText("R$ 99,90").first()).toBeVisible();

    // Endereço estruturado (Usuario -> Endereco), nunca o texto livre do
    // model Cliente legado.
    await expect(page.getByText("Rua das Flores, 123")).toBeVisible();
    await expect(page.getByText("Centro")).toBeVisible();
    await expect(page.getByText("CEP 80000-000")).toBeVisible();

    // Cada pedido do histórico linka para o detalhe real do pedido — nunca
    // uma tela duplicada.
    const linkPedido = page.getByRole("link", { name: "PED-42" });
    await expect(linkPedido).toBeVisible();
    await expect(linkPedido).toHaveAttribute("href", "/workspace-x/pedidos/42");
  });

  test("cliente sem CPF/telefone/endereço/pedidos: mostra os estados vazios corretos, sem quebrar", async ({
    page,
  }) => {
    await seedSession(page);
    mockDetalheCliente(page, CLIENTE_SEM_HISTORICO.id, {
      status: 200,
      body: CLIENTE_SEM_HISTORICO,
    });

    await page.goto(`/workspace-x/clientes/${CLIENTE_SEM_HISTORICO.id}`);

    await expect(page.getByRole("heading", { name: CLIENTE_SEM_HISTORICO.nome })).toBeVisible();
    await expect(page.getByText("Inativo", { exact: true })).toBeVisible();
    await expect(page.getByText("Não informado")).toHaveCount(2); // CPF + Telefone
    await expect(page.getByText("Nenhum endereço cadastrado.")).toBeVisible();
    await expect(page.getByText("Este cliente ainda não fez nenhum pedido.")).toBeVisible();
  });

  test("cliente inexistente (404 do backend): mostra 'Cliente não encontrado', nunca uma tela quebrada", async ({
    page,
  }) => {
    await seedSession(page);
    mockDetalheCliente(page, 999, {
      status: 404,
      body: { message: "Cliente com id 999 não encontrado" },
    });

    await page.goto("/workspace-x/clientes/999");

    await expect(page.getByRole("heading", { name: "Cliente não encontrado" })).toBeVisible();
  });
});

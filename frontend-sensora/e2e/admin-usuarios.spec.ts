import { test, expect, type Page } from "@playwright/test";

// Etapa "Dados do Cliente / Cadastro" (fechamento administrativo) — suíte
// E2E de /admin/usuarios dedicada aos campos novos (CPF/telefone) no
// formulário de criação/edição administrativa. Não recobre o que já era
// coberto antes (guarda ADMIN-only da página, CRUD de nome/email/perfil/
// ativo) — só o que mudou. Mesmo padrão de mock via page.route do resto do
// projeto (backend real indisponível neste ambiente de teste).

const USUARIOS_URL = "/admin/usuarios";
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

const USUARIO_COM_CPF_TELEFONE = {
  id: 5,
  nome: "Cliente Cadastrado",
  email: "cliente.cadastrado@sensora.dev",
  perfil: "CLIENTE",
  ativo: true,
  emailVerificado: true,
  cpf: "52998224725",
  telefone: "41999999999",
};

// GET /usuarios devolve a lista fixa abaixo; POST/PUT registram o corpo
// enviado (para asserção) e respondem simulando o comportamento real do
// backend (usuário criado/atualizado com os campos enviados).
//
// Padrão de URL EXATO (não "**/usuarios"): a API roda num host separado
// (NEXT_PUBLIC_API_URL, porta 3000 — ver services/api.ts) do dev server do
// frontend usado pelo Playwright (porta 3002, ver playwright.config.ts),
// mas a própria página navegada é "/admin/usuarios" — um glob "**/usuarios"
// também casaria com a navegação para essa página (termina em "usuarios"),
// substituindo o HTML da página pelo JSON mockado. Mesmo raciocínio se
// aplicaria a qualquer suíte futura cuja rota do frontend termine com o
// mesmo sufixo do endpoint mockado.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

function mockUsuarios(page: Page): {
  chamadasPost: Record<string, unknown>[];
  chamadasPut: Record<string, unknown>[];
} {
  const chamadasPost: Record<string, unknown>[] = [];
  const chamadasPut: Record<string, unknown>[] = [];

  page.route(`${API_URL}/usuarios`, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: [USUARIO_COM_CPF_TELEFONE] });
      return;
    }
    if (route.request().method() === "POST") {
      const corpo = route.request().postDataJSON() as Record<string, unknown>;
      chamadasPost.push(corpo);
      await route.fulfill({
        status: 201,
        json: {
          id: 99,
          ...corpo,
          cpf: corpo.cpf || null,
          telefone: corpo.telefone || null,
          emailVerificado: true,
        },
      });
      return;
    }
    await route.continue();
  });

  page.route(`${API_URL}/usuarios/5`, async (route) => {
    if (route.request().method() === "PUT") {
      const corpo = route.request().postDataJSON() as Record<string, unknown>;
      chamadasPut.push(corpo);
      await route.fulfill({
        json: {
          ...USUARIO_COM_CPF_TELEFONE,
          ...corpo,
          cpf: corpo.cpf || null,
          telefone: corpo.telefone || null,
        },
      });
      return;
    }
    await route.continue();
  });

  return { chamadasPost, chamadasPut };
}

test.describe("Admin / Usuários — CPF e telefone no formulário", () => {
  test("formulário de criação exibe os campos CPF e telefone", async ({ page }) => {
    await seedSession(page);
    mockUsuarios(page);

    await page.goto(USUARIOS_URL);
    await page.getByRole("button", { name: "Novo usuário" }).click();

    await expect(page.locator("#cpf")).toBeVisible();
    await expect(page.locator("#telefone")).toBeVisible();
  });

  test("editar um usuário carrega CPF e telefone já salvos", async ({ page }) => {
    await seedSession(page);
    mockUsuarios(page);

    await page.goto(USUARIOS_URL);
    await page.getByRole("button", { name: "Editar" }).click();

    // Mesmo comportamento de /conta/dados-pessoais: o valor carregado ao
    // entrar em edição é o normalizado (só dígitos) vindo do backend — a
    // máscara só entra em ação a partir do próximo caractere digitado (ver
    // teste de máscara acima), não reformata o valor já presente no load.
    await expect(page.locator("#cpf")).toHaveValue("52998224725");
    await expect(page.locator("#telefone")).toHaveValue("41999999999");
  });

  test("a máscara de CPF formata os dígitos enquanto o usuário digita", async ({ page }) => {
    await seedSession(page);
    mockUsuarios(page);

    await page.goto(USUARIOS_URL);
    await page.getByRole("button", { name: "Novo usuário" }).click();
    await page.locator("#cpf").fill("52998224725");

    await expect(page.locator("#cpf")).toHaveValue("529.982.247-25");
  });

  test("a máscara de telefone formata os dígitos enquanto o usuário digita", async ({ page }) => {
    await seedSession(page);
    mockUsuarios(page);

    await page.goto(USUARIOS_URL);
    await page.getByRole("button", { name: "Novo usuário" }).click();
    await page.locator("#telefone").fill("41999999999");

    await expect(page.locator("#telefone")).toHaveValue("(41) 99999-9999");
  });

  test("CPF inválido impede o envio e mostra a mensagem de erro", async ({ page }) => {
    await seedSession(page);
    const { chamadasPost } = mockUsuarios(page);

    await page.goto(USUARIOS_URL);
    await page.getByRole("button", { name: "Novo usuário" }).click();
    await page.locator("#nome").fill("Usuario Teste");
    await page.locator("#email").fill("usuario.teste@sensora.dev");
    await page.locator("#senha").fill("senhaSegura123");
    await page.locator("#cpf").fill("12345678900");
    await page.getByRole("button", { name: "Criar usuário" }).click();

    await expect(page.getByText("CPF inválido")).toBeVisible();
    expect(chamadasPost).toHaveLength(0);
  });

  test("criar usuário com CPF e telefone válidos envia os dois campos normalizados ao backend", async ({
    page,
  }) => {
    await seedSession(page);
    const { chamadasPost } = mockUsuarios(page);

    await page.goto(USUARIOS_URL);
    await page.getByRole("button", { name: "Novo usuário" }).click();
    await page.locator("#nome").fill("Usuario Novo");
    await page.locator("#email").fill("usuario.novo@sensora.dev");
    await page.locator("#senha").fill("senhaSegura123");
    await page.locator("#cpf").fill("52998224725");
    await page.locator("#telefone").fill("41999999999");
    await page.getByRole("button", { name: "Criar usuário" }).click();

    await expect(page.getByText("Usuário criado com sucesso.")).toBeVisible();
    expect(chamadasPost).toHaveLength(1);
    // O form envia o valor formatado ("529.982.247-25") — a normalização
    // (só dígitos) é responsabilidade do backend (UsuariosService.create).
    expect(chamadasPost[0].cpf).toBe("529.982.247-25");
    expect(chamadasPost[0].telefone).toBe("(41) 99999-9999");
  });

  test("editar salva alteração de CPF/telefone enviando os valores atualizados", async ({ page }) => {
    await seedSession(page);
    const { chamadasPut } = mockUsuarios(page);

    await page.goto(USUARIOS_URL);
    await page.getByRole("button", { name: "Editar" }).click();
    await page.locator("#cpf").fill("");
    await page.locator("#telefone").fill("41988887777");
    await page.getByRole("button", { name: "Salvar edição" }).click();

    await expect(page.getByText("Usuário atualizado com sucesso.")).toBeVisible();
    expect(chamadasPut).toHaveLength(1);
    expect(chamadasPut[0].cpf).toBe("");
    expect(chamadasPut[0].telefone).toBe("(41) 98888-7777");
  });
});

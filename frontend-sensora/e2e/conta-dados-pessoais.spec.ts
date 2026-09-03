import { test, expect, type Page } from "@playwright/test";

// Etapa "Dados do Cliente / Cadastro" — suíte E2E de /conta/dados-pessoais
// dedicada aos campos novos (CPF/telefone) e ao ciclo completo de edição
// (editar/salvar/cancelar/erro), que ainda não tinha uma suíte própria
// (só a navegação de volta era coberta, em e2e/conta-refinamento.spec.ts).
// Mesmo padrão de mock via page.route do resto do projeto — backend real
// indisponível neste ambiente de teste.
//
// GET e PUT de /usuarios/me são tratados por UM ÚNICO page.route por teste
// (mockMeuPerfil abaixo), de propósito: dois page.route() ativos ao mesmo
// tempo para o mesmo padrão de URL não se encadeiam automaticamente no
// Playwright (route.continue() manda a requisição pra rede real em vez de
// cair no outro handler registrado) — só o mais recente responderia.

const TOKEN_KEY = "sensora_token";
const DADOS_PESSOAIS_URL = "/conta/dados-pessoais";

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

const USUARIO_SEM_CPF_TELEFONE = {
  id: 1,
  nome: "Cliente Sensora",
  email: "cliente@sensora.dev",
  perfil: "CLIENTE",
  ativo: true,
  emailVerificado: true,
  cpf: null,
  telefone: null,
};

const USUARIO_COM_CPF_TELEFONE = {
  ...USUARIO_SEM_CPF_TELEFONE,
  cpf: "52998224725",
  telefone: "41999999999",
};

// GET devolve `usuarioInicial`; PUT devolve `opts.respostaPut` se informado
// (para simular erro, ex.: 409 de CPF duplicado) ou, por padrão, simula o
// comportamento real do backend: o usuário atualizado com exatamente os
// campos enviados (mesma forma de UsuariosService.atualizarMeusDados).
function mockMeuPerfil(
  page: Page,
  usuarioInicial: unknown,
  opts?: { delayMs?: number; respostaPut?: { status: number; body: unknown } },
): Record<string, unknown>[] {
  const chamadasPut: Record<string, unknown>[] = [];

  page.route("**/usuarios/me", async (route) => {
    if (route.request().method() === "GET") {
      if (opts?.delayMs) await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
      await route.fulfill({ json: usuarioInicial });
      return;
    }

    if (route.request().method() === "PUT") {
      const corpo = route.request().postDataJSON() as Record<string, unknown>;
      chamadasPut.push(corpo);

      if (opts?.respostaPut) {
        await route.fulfill({ status: opts.respostaPut.status, json: opts.respostaPut.body });
        return;
      }

      await route.fulfill({
        json: {
          ...USUARIO_SEM_CPF_TELEFONE,
          ...corpo,
          cpf: corpo.cpf || null,
          telefone: corpo.telefone || null,
        },
      });
      return;
    }

    await route.continue();
  });

  return chamadasPut;
}

test.describe("Dados Pessoais — carregamento", () => {
  test("mostra skeleton enquanto carrega, depois os dados corretos", async ({ page }) => {
    await seedSession(page);
    mockMeuPerfil(page, USUARIO_COM_CPF_TELEFONE, { delayMs: 300 });

    await page.goto(DADOS_PESSOAIS_URL);

    // Skeletons (nome/email/cpf/telefone) visíveis antes da resposta chegar.
    await expect(page.locator('[aria-busy="true"]')).toBeVisible();

    await expect(page.getByText("Cliente Sensora")).toBeVisible();
    await expect(page.getByText("cliente@sensora.dev")).toBeVisible();
    await expect(page.getByText("529.982.247-25")).toBeVisible();
    await expect(page.getByText("(41) 99999-9999")).toBeVisible();
  });

  test("erro ao carregar mostra toast, sem travar a página", async ({ page }) => {
    await seedSession(page);
    await page.route("**/usuarios/me", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({ status: 500, json: {} });
        return;
      }
      await route.continue();
    });

    await page.goto(DADOS_PESSOAIS_URL);

    // .first(): em dev, o StrictMode do React duplica o efeito de carga (só
    // em desenvolvimento — build de produção roda uma vez), então o mesmo
    // toast pode aparecer duas vezes; a asserção só precisa confirmar que a
    // mensagem certa apareceu, não quantas vezes.
    await expect(
      page.getByText("Não foi possível carregar seus dados.").first(),
    ).toBeVisible();
  });

  test("CPF/telefone nunca preenchidos mostram 'Não informado' e o botão 'Adicionar'", async ({
    page,
  }) => {
    await seedSession(page);
    mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);

    await expect(page.getByText("Não informado")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Adicionar" })).toHaveCount(2);
  });

  test("CPF/telefone já preenchidos mostram formatados e o botão 'Editar'", async ({ page }) => {
    await seedSession(page);
    mockMeuPerfil(page, USUARIO_COM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);

    await expect(page.getByText("529.982.247-25")).toBeVisible();
    await expect(page.getByText("(41) 99999-9999")).toBeVisible();
    await expect(page.getByText("Não informado")).toHaveCount(0);
  });
});

test.describe("Dados Pessoais — CPF", () => {
  test("adicionar CPF válido: salva, mostra sucesso e passa a exibir formatado", async ({
    page,
  }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardCpf = page.locator("form > div").filter({ hasText: "CPF" });
    await cardCpf.getByRole("button", { name: "Adicionar" }).click();
    await cardCpf.locator("#cpf").fill("52998224725");
    await cardCpf.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Dados atualizados com sucesso.")).toBeVisible();
    await expect(cardCpf.getByText("529.982.247-25")).toBeVisible();
    await expect(cardCpf.getByRole("button", { name: "Editar" })).toBeVisible();

    expect(chamadasPut).toHaveLength(1);
    // Sempre envia nome/email junto (whitelist do backend exige os dois),
    // mesmo padrão já usado por nome/email isoladamente.
    expect(chamadasPut[0].nome).toBe("Cliente Sensora");
    expect(chamadasPut[0].email).toBe("cliente@sensora.dev");
  });

  test("CPF inválido (dígitos verificadores errados): mostra erro, nunca chama a API", async ({
    page,
  }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardCpf = page.locator("form > div").filter({ hasText: "CPF" });
    await cardCpf.getByRole("button", { name: "Adicionar" }).click();
    await cardCpf.locator("#cpf").fill("12345678900");
    await cardCpf.getByRole("button", { name: "Salvar" }).click();

    await expect(cardCpf.getByText("CPF inválido")).toBeVisible();
    expect(chamadasPut).toHaveLength(0);
  });

  test("CPF vazio: limpa um CPF já cadastrado, volta a 'Não informado'", async ({ page }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_COM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardCpf = page.locator("form > div").filter({ hasText: "CPF" });
    await cardCpf.getByRole("button", { name: "Editar" }).click();
    await cardCpf.locator("#cpf").fill("");
    await cardCpf.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Dados atualizados com sucesso.")).toBeVisible();
    await expect(cardCpf.getByText("Não informado")).toBeVisible();
    await expect(cardCpf.getByRole("button", { name: "Adicionar" })).toBeVisible();
    expect(chamadasPut[0].cpf).toBe("");
  });

  test("cancelar a edição do CPF descarta a alteração e não chama a API", async ({ page }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardCpf = page.locator("form > div").filter({ hasText: "CPF" });
    await cardCpf.getByRole("button", { name: "Adicionar" }).click();
    await cardCpf.locator("#cpf").fill("52998224725");
    await cardCpf.getByRole("button", { name: "Cancelar" }).click();

    await expect(cardCpf.getByText("Não informado")).toBeVisible();
    await expect(cardCpf.getByRole("button", { name: "Adicionar" })).toBeVisible();
    expect(chamadasPut).toHaveLength(0);
  });

  test("CPF duplicado (409 do backend): mostra a mensagem do backend, permanece em edição", async ({
    page,
  }) => {
    await seedSession(page);
    mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE, {
      respostaPut: {
        status: 409,
        body: { message: "Este CPF já está em uso por outra conta." },
      },
    });

    await page.goto(DADOS_PESSOAIS_URL);
    const cardCpf = page.locator("form > div").filter({ hasText: "CPF" });
    await cardCpf.getByRole("button", { name: "Adicionar" }).click();
    await cardCpf.locator("#cpf").fill("52998224725");
    await cardCpf.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Este CPF já está em uso por outra conta.")).toBeVisible();
    // Continua em modo de edição — erro não fecha o card nem limpa o valor.
    await expect(cardCpf.getByRole("button", { name: "Salvar" })).toBeVisible();
  });
});

test.describe("Dados Pessoais — Telefone", () => {
  test("adicionar telefone válido: salva, mostra sucesso e passa a exibir formatado", async ({
    page,
  }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardTelefone = page.locator("form > div").filter({ hasText: "Telefone" });
    await cardTelefone.getByRole("button", { name: "Adicionar" }).click();
    await cardTelefone.locator("#telefone").fill("41999999999");
    await cardTelefone.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Dados atualizados com sucesso.")).toBeVisible();
    await expect(cardTelefone.getByText("(41) 99999-9999")).toBeVisible();
    expect(chamadasPut).toHaveLength(1);
  });

  test("telefone inválido (poucos dígitos): mostra erro, nunca chama a API", async ({ page }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardTelefone = page.locator("form > div").filter({ hasText: "Telefone" });
    await cardTelefone.getByRole("button", { name: "Adicionar" }).click();
    await cardTelefone.locator("#telefone").fill("123");
    await cardTelefone.getByRole("button", { name: "Salvar" }).click();

    await expect(cardTelefone.getByText("Telefone inválido")).toBeVisible();
    expect(chamadasPut).toHaveLength(0);
  });

  test("telefone vazio: limpa um telefone já cadastrado, volta a 'Não informado'", async ({
    page,
  }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_COM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardTelefone = page.locator("form > div").filter({ hasText: "Telefone" });
    await cardTelefone.getByRole("button", { name: "Editar" }).click();
    await cardTelefone.locator("#telefone").fill("");
    await cardTelefone.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Dados atualizados com sucesso.")).toBeVisible();
    await expect(cardTelefone.getByText("Não informado")).toBeVisible();
    expect(chamadasPut[0].telefone).toBe("");
  });

  test("cancelar a edição do telefone descarta a alteração e não chama a API", async ({
    page,
  }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardTelefone = page.locator("form > div").filter({ hasText: "Telefone" });
    await cardTelefone.getByRole("button", { name: "Adicionar" }).click();
    await cardTelefone.locator("#telefone").fill("41999999999");
    await cardTelefone.getByRole("button", { name: "Cancelar" }).click();

    await expect(cardTelefone.getByText("Não informado")).toBeVisible();
    expect(chamadasPut).toHaveLength(0);
  });
});

test.describe("Dados Pessoais — regressão (nome/email preservados)", () => {
  test("editar nome não altera CPF/telefone já salvos", async ({ page }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_COM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardNome = page.locator("form > div").filter({ hasText: "Nome" }).first();
    await cardNome.getByRole("button", { name: "Editar" }).click();
    await cardNome.locator("#nome").fill("Cliente Sensora Editado");
    await cardNome.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Dados atualizados com sucesso.")).toBeVisible();
    expect(chamadasPut[0].cpf).toBe("52998224725");
    expect(chamadasPut[0].telefone).toBe("41999999999");
  });
});

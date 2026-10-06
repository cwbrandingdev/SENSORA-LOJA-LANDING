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

// GET devolve o estado atual (começa em `usuarioInicial`); PUT devolve
// `opts.respostaPut` se informado (para simular erro, ex.: 409 de CPF
// duplicado) ou, por padrão, simula o comportamento real do backend
// (UsuariosService.atualizarMeusDados): grava nome/CPF/telefone e, se o
// e-mail normalizado mudou, mantém o atual e guarda o novo em
// `emailPendente` (MÉDIO-3). O estado vale para os GETs seguintes.
function mockMeuPerfil(
  page: Page,
  usuarioInicial: unknown,
  opts?: { delayMs?: number; respostaPut?: { status: number; body: unknown } },
): Record<string, unknown>[] {
  const chamadasPut: Record<string, unknown>[] = [];
  let estado = usuarioInicial as Record<string, unknown>;

  page.route("**/usuarios/me", async (route) => {
    if (route.request().method() === "GET") {
      if (opts?.delayMs) await new Promise((resolve) => setTimeout(resolve, opts.delayMs));
      await route.fulfill({ json: estado });
      return;
    }

    if (route.request().method() === "PUT") {
      const corpo = route.request().postDataJSON() as Record<string, unknown>;
      chamadasPut.push(corpo);

      if (opts?.respostaPut) {
        await route.fulfill({ status: opts.respostaPut.status, json: opts.respostaPut.body });
        return;
      }

      const emailNovo = String(corpo.email).trim().toLowerCase();
      estado = {
        ...estado,
        nome: corpo.nome,
        cpf: corpo.cpf || null,
        telefone: corpo.telefone || null,
        ...(emailNovo !== estado.email && { emailPendente: emailNovo }),
      };
      await route.fulfill({ json: estado });
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

    // Nome e e-mail também aparecem no cartão de perfil do topo; confere os
    // blocos de campos.
    const campos = page.locator("form .grid");
    await expect(campos.getByText("Cliente Sensora")).toBeVisible();
    await expect(campos.getByText("cliente@sensora.dev")).toBeVisible();
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
    const cardCpf = page.locator("form .grid > div").filter({ hasText: "CPF" });
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
    const cardCpf = page.locator("form .grid > div").filter({ hasText: "CPF" });
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
    const cardCpf = page.locator("form .grid > div").filter({ hasText: "CPF" });
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
    const cardCpf = page.locator("form .grid > div").filter({ hasText: "CPF" });
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
    const cardCpf = page.locator("form .grid > div").filter({ hasText: "CPF" });
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
    const cardTelefone = page.locator("form .grid > div").filter({ hasText: "Telefone" });
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
    const cardTelefone = page.locator("form .grid > div").filter({ hasText: "Telefone" });
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
    const cardTelefone = page.locator("form .grid > div").filter({ hasText: "Telefone" });
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
    const cardTelefone = page.locator("form .grid > div").filter({ hasText: "Telefone" });
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
    const cardNome = page.locator("form .grid > div").filter({ hasText: "Nome" }).first();
    await cardNome.getByRole("button", { name: "Editar" }).click();
    await cardNome.locator("#nome").fill("Cliente Sensora Editado");
    await cardNome.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Dados atualizados com sucesso.")).toBeVisible();
    expect(chamadasPut[0].cpf).toBe("52998224725");
    expect(chamadasPut[0].telefone).toBe("41999999999");
  });
});

// ALTO-2 — trocar o e-mail exige a senha atual. O campo "Senha atual" só
// aparece quando o e-mail normalizado muda, e `senhaAtual` só vai no PUT
// nesse caso.
test.describe("Dados Pessoais — troca de e-mail exige a senha atual", () => {
  function cartao(page: Page, rotulo: string) {
    return page.locator("form .grid > div").filter({ hasText: rotulo }).first();
  }

  test("editar só o nome: não mostra senha e não envia senhaAtual", async ({ page }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_COM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardNome = cartao(page, "Nome");
    await cardNome.getByRole("button", { name: "Editar" }).click();
    await cardNome.locator("#nome").fill("Cliente Sensora Editado");
    await expect(page.getByLabel("Senha atual")).toHaveCount(0);
    await cardNome.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Dados atualizados com sucesso.")).toBeVisible();
    expect(chamadasPut[0]).not.toHaveProperty("senhaAtual");
  });

  test("editar só o CPF: não mostra senha e não envia senhaAtual", async ({ page }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardCpf = cartao(page, "CPF");
    await cardCpf.getByRole("button", { name: "Adicionar" }).click();
    await cardCpf.locator("#cpf").fill("52998224725");
    await expect(page.getByLabel("Senha atual")).toHaveCount(0);
    await cardCpf.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Dados atualizados com sucesso.")).toBeVisible();
    expect(chamadasPut[0]).not.toHaveProperty("senhaAtual");
  });

  test("editar só o telefone: não mostra senha e não envia senhaAtual", async ({ page }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardTelefone = cartao(page, "Telefone");
    await cardTelefone.getByRole("button", { name: "Adicionar" }).click();
    await cardTelefone.locator("#telefone").fill("41999999999");
    await expect(page.getByLabel("Senha atual")).toHaveCount(0);
    await cardTelefone.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Dados atualizados com sucesso.")).toBeVisible();
    expect(chamadasPut[0]).not.toHaveProperty("senhaAtual");
  });

  test("mesmo e-mail com outra caixa/espaços: não pede senha e não envia senhaAtual", async ({
    page,
  }) => {
    await seedSession(page);
    // O backend devolve o e-mail já normalizado.
    const chamadasPut = mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE, {
      respostaPut: { status: 200, body: USUARIO_SEM_CPF_TELEFONE },
    });

    await page.goto(DADOS_PESSOAIS_URL);
    const cardEmail = cartao(page, "E-mail");
    await cardEmail.getByRole("button", { name: "Editar" }).click();
    // Espaços nas pontas não contam como troca (o formulário já recusa
    // espaços no e-mail ao salvar, então o envio é conferido só com a caixa).
    await cardEmail.locator("#email").fill(" cliente@sensora.dev ");
    await expect(page.getByLabel("Senha atual")).toHaveCount(0);
    await cardEmail.locator("#email").fill("Cliente@Sensora.DEV");
    await expect(page.getByLabel("Senha atual")).toHaveCount(0);
    await cardEmail.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Dados atualizados com sucesso.")).toBeVisible();
    expect(chamadasPut[0]).not.toHaveProperty("senhaAtual");
  });

  test("e-mail novo: mostra 'Senha atual' e envia senhaAtual no PUT", async ({ page }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardEmail = cartao(page, "E-mail");
    await cardEmail.getByRole("button", { name: "Editar" }).click();
    await expect(page.getByLabel("Senha atual")).toHaveCount(0);
    await cardEmail.locator("#email").fill("novo@sensora.dev");
    await expect(page.getByLabel("Senha atual")).toBeVisible();
    await expect(page.getByLabel("Senha atual")).toHaveAttribute("type", "password");
    await page.getByLabel("Senha atual").fill("minhaSenha123");
    await cardEmail.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText(/Seu e-mail atual continua sendo o oficial/)).toBeVisible();
    expect(chamadasPut).toHaveLength(1);
    expect(chamadasPut[0].email).toBe("novo@sensora.dev");
    expect(chamadasPut[0].senhaAtual).toBe("minhaSenha123");
  });

  test("e-mail novo sem senha: pede a senha e não chama a API", async ({ page }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardEmail = cartao(page, "E-mail");
    await cardEmail.getByRole("button", { name: "Editar" }).click();
    await cardEmail.locator("#email").fill("novo@sensora.dev");
    await cardEmail.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Informe sua senha atual para alterar o e-mail.")).toBeVisible();
    expect(chamadasPut).toHaveLength(0);
  });

  test("senha incorreta (400): mostra a mensagem no campo, sem sair da página", async ({ page }) => {
    await seedSession(page);
    mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE, {
      respostaPut: {
        status: 400,
        body: { statusCode: 400, message: "Senha atual incorreta." },
      },
    });

    await page.goto(DADOS_PESSOAIS_URL);
    const cardEmail = cartao(page, "E-mail");
    await cardEmail.getByRole("button", { name: "Editar" }).click();
    await cardEmail.locator("#email").fill("novo@sensora.dev");
    await page.getByLabel("Senha atual").fill("senhaErrada");
    await cardEmail.getByRole("button", { name: "Salvar" }).click();

    await expect(cardEmail.getByText("Senha atual incorreta.")).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${DADOS_PESSOAIS_URL}$`));
    await expect(cardEmail.locator("#email")).toHaveValue("novo@sensora.dev");
  });

  test("cooldown (429): mostra a mensagem e mantém o que foi digitado", async ({ page }) => {
    await seedSession(page);
    mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE, {
      respostaPut: {
        status: 429,
        body: {
          statusCode: 429,
          message: "Aguarde um minuto antes de alterar o e-mail novamente.",
        },
      },
    });

    await page.goto(DADOS_PESSOAIS_URL);
    const cardEmail = cartao(page, "E-mail");
    await cardEmail.getByRole("button", { name: "Editar" }).click();
    await cardEmail.locator("#email").fill("novo@sensora.dev");
    await page.getByLabel("Senha atual").fill("minhaSenha123");
    await cardEmail.getByRole("button", { name: "Salvar" }).click();

    await expect(
      page.getByText("Aguarde um minuto antes de alterar o e-mail novamente.").first(),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`${DADOS_PESSOAIS_URL}$`));
    await expect(cardEmail.locator("#email")).toHaveValue("novo@sensora.dev");
    await expect(page.getByLabel("Senha atual")).toHaveValue("minhaSenha123");
  });

  test("troca aceita: mostra a troca pendente e a senha não fica guardada", async ({
    page,
  }) => {
    await seedSession(page);
    mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardEmail = cartao(page, "E-mail");
    await cardEmail.getByRole("button", { name: "Editar" }).click();
    await cardEmail.locator("#email").fill("novo@sensora.dev");
    await page.getByLabel("Senha atual").fill("minhaSenha123");
    await cardEmail.getByRole("button", { name: "Salvar" }).click();

    await expect(
      page.getByText(/Enviamos um link de confirmação para novo@sensora\.dev/),
    ).toBeVisible();
    await expect(cardEmail.getByText("Troca de e-mail pendente")).toBeVisible();
    await expect(page.getByLabel("Senha atual")).toHaveCount(0);

    // Reabrir a edição e digitar outro e-mail: o campo volta vazio.
    await cardEmail.getByRole("button", { name: "Editar" }).click();
    await cardEmail.locator("#email").fill("outro@sensora.dev");
    await expect(page.getByLabel("Senha atual")).toHaveValue("");
  });

  test("cancelar a edição descarta a senha digitada", async ({ page }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardEmail = cartao(page, "E-mail");
    await cardEmail.getByRole("button", { name: "Editar" }).click();
    await cardEmail.locator("#email").fill("novo@sensora.dev");
    await page.getByLabel("Senha atual").fill("minhaSenha123");
    await cardEmail.getByRole("button", { name: "Cancelar" }).click();

    await cardEmail.getByRole("button", { name: "Editar" }).click();
    await cardEmail.locator("#email").fill("novo@sensora.dev");
    await expect(page.getByLabel("Senha atual")).toHaveValue("");
    expect(chamadasPut).toHaveLength(0);
  });
});

// MÉDIO-3 — troca de e-mail pendente. O backend mantém `email` como o
// oficial e devolve o novo em `emailPendente` até a confirmação pelo link.
test.describe("Dados Pessoais — troca de e-mail pendente (MÉDIO-3)", () => {
  const USUARIO_COM_PENDENTE = {
    ...USUARIO_SEM_CPF_TELEFONE,
    emailPendente: "novo@sensora.dev",
  };

  function cartao(page: Page, rotulo: string) {
    return page.locator("form .grid > div").filter({ hasText: rotulo }).first();
  }

  async function trocarEmail(page: Page, novoEmail: string) {
    const cardEmail = cartao(page, "E-mail");
    await cardEmail.getByRole("button", { name: "Editar" }).click();
    await cardEmail.locator("#email").fill(novoEmail);
    await page.getByLabel("Senha atual").fill("minhaSenha123");
    await cardEmail.getByRole("button", { name: "Salvar" }).click();
  }

  const edicoesSemEmail = [
    { rotulo: "Nome", botao: "Editar", campo: "#nome", valor: "Cliente Editado" },
    { rotulo: "CPF", botao: "Adicionar", campo: "#cpf", valor: "52998224725" },
    { rotulo: "Telefone", botao: "Adicionar", campo: "#telefone", valor: "41999999999" },
  ];

  for (const edicao of edicoesSemEmail) {
    test(`editar só ${edicao.rotulo}: nenhuma troca pendente aparece`, async ({ page }) => {
      await seedSession(page);
      mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

      await page.goto(DADOS_PESSOAIS_URL);
      const card = cartao(page, edicao.rotulo);
      await card.getByRole("button", { name: edicao.botao }).click();
      await card.locator(edicao.campo).fill(edicao.valor);
      await card.getByRole("button", { name: "Salvar" }).click();

      await expect(page.getByText("Dados atualizados com sucesso.")).toBeVisible();
      await expect(page.getByText("Troca de e-mail pendente")).toHaveCount(0);
    });
  }

  test("mesmo e-mail com outra caixa: nenhuma troca pendente é criada", async ({ page }) => {
    await seedSession(page);
    mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardEmail = cartao(page, "E-mail");
    await cardEmail.getByRole("button", { name: "Editar" }).click();
    await cardEmail.locator("#email").fill("Cliente@Sensora.DEV");
    await cardEmail.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Dados atualizados com sucesso.")).toBeVisible();
    await expect(page.getByText("Troca de e-mail pendente")).toHaveCount(0);
  });

  test("novo e-mail: o atual continua como oficial e o novo aparece como pendente", async ({
    page,
  }) => {
    await seedSession(page);
    mockMeuPerfil(page, USUARIO_SEM_CPF_TELEFONE);

    await page.goto(DADOS_PESSOAIS_URL);
    await trocarEmail(page, "novo@sensora.dev");

    await expect(
      page.getByText(
        "Dados atualizados com sucesso. Seu e-mail atual continua sendo o oficial até você confirmar o novo endereço. Enviamos um link de confirmação para novo@sensora.dev.",
      ),
    ).toBeVisible();

    const cardEmail = cartao(page, "E-mail");
    // Valor principal do bloco e cartão de perfil do topo: o e-mail atual.
    await expect(cardEmail.locator("p.text-base")).toHaveText("cliente@sensora.dev");
    const topo = page.locator("form .bg-brand-navy");
    await expect(topo).toContainText("cliente@sensora.dev");
    await expect(topo).not.toContainText("novo@sensora.dev");
    await expect(topo.getByText("E-mail confirmado")).toBeVisible();

    // O novo só aparece no aviso de troca pendente.
    await expect(cardEmail.getByText("Troca de e-mail pendente")).toBeVisible();
    await expect(cardEmail.getByText("novo@sensora.dev")).toBeVisible();
    await expect(
      cardEmail.getByText("Confirme o link enviado para concluir a alteração."),
    ).toBeVisible();
  });

  test("cancelar uma nova edição do e-mail não remove a troca pendente", async ({ page }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_COM_PENDENTE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardEmail = cartao(page, "E-mail");
    await expect(cardEmail.getByText("Troca de e-mail pendente")).toBeVisible();

    await cardEmail.getByRole("button", { name: "Editar" }).click();
    await cardEmail.getByRole("button", { name: "Cancelar" }).click();

    await expect(cardEmail.getByText("Troca de e-mail pendente")).toBeVisible();
    await expect(cardEmail.getByText("novo@sensora.dev")).toBeVisible();
    expect(chamadasPut).toHaveLength(0);
  });

  test("editar outro campo depois da troca não remove a troca pendente", async ({ page }) => {
    await seedSession(page);
    const chamadasPut = mockMeuPerfil(page, USUARIO_COM_PENDENTE);

    await page.goto(DADOS_PESSOAIS_URL);
    const cardNome = cartao(page, "Nome");
    await cardNome.getByRole("button", { name: "Editar" }).click();
    await cardNome.locator("#nome").fill("Cliente Editado");
    await cardNome.getByRole("button", { name: "Salvar" }).click();

    await expect(page.getByText("Dados atualizados com sucesso.")).toBeVisible();
    const cardEmail = cartao(page, "E-mail");
    await expect(cardEmail.getByText("Troca de e-mail pendente")).toBeVisible();
    await expect(cardEmail.getByText("novo@sensora.dev")).toBeVisible();
    // O formulário manda o e-mail atual, sem senha: não é uma troca.
    expect(chamadasPut[0].email).toBe("cliente@sensora.dev");
    expect(chamadasPut[0]).not.toHaveProperty("senhaAtual");
  });

  test("depois de confirmar pelo link, o novo e-mail aparece como oficial e a troca pendente some", async ({
    page,
  }) => {
    await page.route("**/auth/verify-email", (route) =>
      route.fulfill({ json: { message: "E-mail confirmado com sucesso." } }),
    );

    await page.goto("/confirmar-email?token=token-da-troca");
    await page.getByRole("button", { name: "Confirmar meu e-mail" }).click();
    await expect(page.getByText("E-mail confirmado com sucesso.")).toBeVisible();

    // Próximo carregamento de Minha Conta: o backend já devolve o novo como
    // `email` e nenhum pendente.
    await seedSession(page);
    mockMeuPerfil(page, {
      ...USUARIO_SEM_CPF_TELEFONE,
      email: "novo@sensora.dev",
      emailPendente: null,
    });
    await page.goto(DADOS_PESSOAIS_URL);

    const cardEmail = cartao(page, "E-mail");
    await expect(cardEmail.locator("p.text-base")).toHaveText("novo@sensora.dev");
    await expect(page.getByText("Troca de e-mail pendente")).toHaveCount(0);
    await expect(page.locator("form .bg-brand-navy").getByText("E-mail confirmado")).toBeVisible();
  });

  test("conflito (409) na confirmação: mensagem amigável, sem detalhes internos nem reenvio", async ({
    page,
  }) => {
    await page.route("**/auth/verify-email", (route) =>
      route.fulfill({
        status: 409,
        json: {
          statusCode: 409,
          message: "Este e-mail já está em uso por outra conta.",
        },
      }),
    );

    await page.goto("/confirmar-email?token=token-da-troca");
    await page.getByRole("button", { name: "Confirmar meu e-mail" }).click();

    await expect(page.getByText("Este e-mail já está em uso por outra conta.")).toBeVisible();
    await expect(
      page.getByText(/A troca de e-mail foi cancelada e o e-mail da sua conta continua/),
    ).toBeVisible();
    await expect(page.getByText(/P2002|Prisma/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Reenviar/ })).toHaveCount(0);
  });
});

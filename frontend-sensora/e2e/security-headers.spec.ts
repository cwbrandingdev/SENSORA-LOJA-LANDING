import { test, expect } from "@playwright/test";

// Etapa 8.5 (Security Headers) — garante que os headers de segurança
// definidos em next.config.ts (`headers()`) são realmente enviados pelo
// servidor em resposta a requisições reais, não só que a configuração
// existe no arquivo. Usa `request.get` (sem executar JS) para inspecionar
// os headers HTTP brutos de cada rota.

const ROTAS = ["/", "/login", "/conta", "/loja"];

for (const rota of ROTAS) {
  test(`GET ${rota} envia os headers de segurança obrigatórios`, async ({ request }) => {
    const response = await request.get(rota);
    const headers = response.headers();

    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBe(
      "camera=(), microphone=(), geolocation=(), payment=()",
    );
    expect(headers["strict-transport-security"]).toContain("max-age=31536000");

    // Clickjacking: bloqueado nas duas camadas (header legado + CSP moderna).
    expect(headers["content-security-policy"]).toContain("frame-ancestors 'none'");

    // Nenhum wildcard/CSP permissiva demais (ver relatório da Etapa 8.5).
    // 'unsafe-eval' NÃO é checado aqui: esta suíte roda contra `next dev`
    // (ver playwright.config.ts), e a CSP inclui 'unsafe-eval' só em
    // desenvolvimento (React usa eval() para stack traces das DevTools,
    // nunca em produção — ver o comentário em next.config.ts). O build de
    // produção (`next build` + `next start`) foi verificado manualmente
    // sem 'unsafe-eval' no header.
    expect(headers["content-security-policy"]).toContain("default-src 'self'");
    expect(headers["content-security-policy"]).not.toContain("script-src *");
    expect(headers["content-security-policy"]).not.toContain("default-src *");

    // Fingerprinting: header removido via `poweredByHeader: false`.
    expect(headers["x-powered-by"]).toBeUndefined();
  });
}

test("a CSP libera exatamente os hosts externos documentados (ImageKit)", async ({ request }) => {
  const response = await request.get("/");
  const csp = response.headers()["content-security-policy"];

  expect(csp).toContain("https://ik.imagekit.io");
  expect(csp).toContain("https://upload.imagekit.io");
});

test("a landing carrega sem violação de CSP no console do navegador", async ({ page }) => {
  const violacoesCsp: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) {
      violacoesCsp.push(msg.text());
    }
  });

  await page.goto("/");
  await expect(page.locator("body")).toBeVisible();

  expect(violacoesCsp).toEqual([]);
});

test("a página de login carrega e permite digitar sem violação de CSP", async ({ page }) => {
  const violacoesCsp: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && /Content Security Policy/i.test(msg.text())) {
      violacoesCsp.push(msg.text());
    }
  });

  await page.goto("/login");
  await page.locator("#login-email").fill("teste@example.com");

  expect(violacoesCsp).toEqual([]);
});

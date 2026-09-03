import { test, expect } from "@playwright/test";
import {
  LIMITE_ESTOQUE_BAIXO,
  estoqueInsuficienteNoCarrinho,
  mensagemEstoque,
  statusEstoque,
} from "../lib/estoque";

// Etapa 6.6 (aviso de estoque) — cobre a regra central usada por
// ProductCard, AddToCartControls e CartItemRow (ver lib/estoque.ts), para
// todos os patamares pedidos na auditoria: 0, 1, 2, 5, 6, 10. Roda como
// Playwright test (sem `page`) porque o projeto não tem um test runner de
// unidade (jest/vitest) configurado no frontend — o runner do Playwright já
// transpila TS e é a suíte de testes existente, então reaproveitá-la aqui
// evita adicionar uma dependência nova só para testar uma função pura.
test.describe("lib/estoque — statusEstoque/mensagemEstoque", () => {
  test("estoque 0 → ESGOTADO / \"Esgotado\"", () => {
    expect(statusEstoque(0)).toBe("ESGOTADO");
    expect(mensagemEstoque(0)).toBe("Esgotado");
  });

  test("estoque 1 → ULTIMA_UNIDADE / \"Última unidade disponível\"", () => {
    expect(statusEstoque(1)).toBe("ULTIMA_UNIDADE");
    expect(mensagemEstoque(1)).toBe("Última unidade disponível");
  });

  test("estoque 2 → POUCAS_UNIDADES / \"Restam poucas unidades\"", () => {
    expect(statusEstoque(2)).toBe("POUCAS_UNIDADES");
    expect(mensagemEstoque(2)).toBe("Restam poucas unidades");
  });

  test("estoque 5 (limite) → ainda POUCAS_UNIDADES", () => {
    expect(statusEstoque(5)).toBe("POUCAS_UNIDADES");
    expect(mensagemEstoque(5)).toBe("Restam poucas unidades");
  });

  test("estoque 6 (acima do limite) → DISPONIVEL, sem mensagem", () => {
    expect(statusEstoque(6)).toBe("DISPONIVEL");
    expect(mensagemEstoque(6)).toBeNull();
  });

  test("estoque 10 → DISPONIVEL, sem mensagem", () => {
    expect(statusEstoque(10)).toBe("DISPONIVEL");
    expect(mensagemEstoque(10)).toBeNull();
  });

  test("LIMITE_ESTOQUE_BAIXO é 5 — única definição, sem número mágico duplicado", () => {
    expect(LIMITE_ESTOQUE_BAIXO).toBe(5);
  });
});

test.describe("lib/estoque — estoqueInsuficienteNoCarrinho", () => {
  test("quantidade no carrinho maior que o estoque conhecido → true", () => {
    expect(estoqueInsuficienteNoCarrinho(3, 2)).toBe(true);
  });

  test("quantidade no carrinho igual ao estoque conhecido → false", () => {
    expect(estoqueInsuficienteNoCarrinho(2, 2)).toBe(false);
  });

  test("quantidade no carrinho menor que o estoque conhecido → false", () => {
    expect(estoqueInsuficienteNoCarrinho(1, 5)).toBe(false);
  });

  test("estoque conhecido indefinido (carrinho salvo antes desta mudança) → false, nunca bloqueia por falta de dado", () => {
    expect(estoqueInsuficienteNoCarrinho(10, undefined)).toBe(false);
  });
});

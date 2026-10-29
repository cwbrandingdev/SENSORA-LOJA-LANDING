import { calcularDesconto, ratearDesconto } from './cupom-desconto';

describe('calcularDesconto', () => {
  it('aplica porcentagem sobre o subtotal dos produtos', () => {
    expect(
      calcularDesconto({ tipo: 'PERCENTUAL', valor: 10, subtotal: 39.9 }),
    ).toBe(3.99);
  });

  it('não deixa o desconto em reais passar do subtotal', () => {
    expect(calcularDesconto({ tipo: 'FIXO', valor: 50, subtotal: 20 })).toBe(
      20,
    );
  });

  it('devolve zero quando não há produtos', () => {
    expect(
      calcularDesconto({ tipo: 'PERCENTUAL', valor: 10, subtotal: 0 }),
    ).toBe(0);
  });
});

describe('ratearDesconto', () => {
  it('mantém a soma das linhas igual ao subtotal menos o desconto', () => {
    const linhas = ratearDesconto(
      [
        { nome: 'Vela', preco: 39.9, quantidade: 2 },
        { nome: 'Spray', preco: 1, quantidade: 3 },
      ],
      7.98,
    );
    const soma = linhas.reduce(
      (total, linha) =>
        total + Math.round(linha.preco * 100) * linha.quantidade,
      0,
    );
    const original =
      Math.round(39.9 * 100) * 2 + Math.round(1 * 100) * 3;
    expect(soma).toBe(original - 798);
  });

  it('não altera as linhas quando o desconto é zero', () => {
    const itens = [{ preco: 10, quantidade: 1 }];
    expect(ratearDesconto(itens, 0)).toEqual(itens);
  });
});

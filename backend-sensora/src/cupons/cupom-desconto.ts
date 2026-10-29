// Conta do desconto e o rateio nas linhas enviadas ao gateway. O ItemPedido
// guarda o preço de catálogo; só a cobrança (Asaas/Stripe) recebe o valor
// já com o desconto, para a soma das linhas bater com Pedido.total.

export function arredondarReais(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function calcularDesconto(params: {
  tipo: 'PERCENTUAL' | 'FIXO';
  valor: number;
  subtotal: number;
}): number {
  if (params.subtotal <= 0) {
    return 0;
  }
  const bruto =
    params.tipo === 'PERCENTUAL'
      ? (params.subtotal * params.valor) / 100
      : params.valor;
  return arredondarReais(Math.min(params.subtotal, Math.max(0, bruto)));
}

type Linha = { preco: number; quantidade: number };

// Reparte o desconto (em centavos) entre os produtos. Se a sobra de centavos
// não divide pela quantidade, a linha vira duas: o mesmo produto com preços
// unitários que diferem 1 centavo, para a soma continuar exata.
export function ratearDesconto<T extends Linha>(itens: T[], desconto: number): T[] {
  const descontoCentavos = Math.round(desconto * 100);
  if (descontoCentavos <= 0 || itens.length === 0) {
    return itens.map((item) => ({ ...item }));
  }

  const linhas = itens.map((item) => ({
    item,
    centavos: Math.round(item.preco * 100) * item.quantidade,
  }));
  const soma = linhas.reduce((total, linha) => total + linha.centavos, 0);
  if (soma <= 0) {
    return itens.map((item) => ({ ...item }));
  }

  const teto = Math.min(descontoCentavos, soma);
  const parcelas = linhas.map(
    (linha) => Math.floor((linha.centavos * teto) / soma),
  );
  const folga = linhas.map(
    (linha, index) => linha.centavos - parcelas[index],
  );
  let sobra = teto - parcelas.reduce((total, parcela) => total + parcela, 0);
  let cursor = 0;
  while (sobra > 0 && folga.some((resto) => resto > 0)) {
    const indice = cursor % linhas.length;
    if (folga[indice] > 0) {
      parcelas[indice] += 1;
      folga[indice] -= 1;
      sobra -= 1;
    }
    cursor += 1;
  }

  const partes: T[] = [];
  linhas.forEach((linha, index) => {
    const novoTotal = linha.centavos - parcelas[index];
    if (novoTotal <= 0) {
      return;
    }
    const quantidade = linha.item.quantidade;
    const unitario = Math.floor(novoTotal / quantidade);
    const extra = novoTotal - unitario * quantidade;
    const base = quantidade - extra;
    if (base > 0 && unitario > 0) {
      partes.push({
        ...linha.item,
        preco: unitario / 100,
        quantidade: base,
      });
    }
    if (extra > 0) {
      partes.push({
        ...linha.item,
        preco: (unitario + 1) / 100,
        quantidade: extra,
      });
    }
  });
  return partes;
}

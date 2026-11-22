// Confirmação da edição em lote: lista, produto por produto, o valor de
// antes e o de depois. Só entra o que realmente muda.
import type { AlteracaoProduto, Produto } from "@/lib/types/loja";

const formatPrice = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

// Tira do rascunho o que não muda nada (ex.: digitou o mesmo preço de antes).
export function mudancasReais(
  produtos: Produto[],
  rascunho: Record<number, AlteracaoProduto>,
): AlteracaoProduto[] {
  return produtos.flatMap((produto) => {
    const mudanca = rascunho[produto.id];
    if (!mudanca) return [];

    const real: AlteracaoProduto = { id: produto.id };
    if (mudanca.preco !== undefined && mudanca.preco !== produto.preco) real.preco = mudanca.preco;
    if (mudanca.quantidade !== undefined && mudanca.quantidade !== produto.quantidade) {
      real.quantidade = mudanca.quantidade;
    }
    if (mudanca.somarEstoque) real.somarEstoque = mudanca.somarEstoque;
    if (mudanca.ativo !== undefined && mudanca.ativo !== produto.ativo) real.ativo = mudanca.ativo;

    // Só o id = nada mudou neste produto.
    return Object.keys(real).length > 1 ? [real] : [];
  });
}

// Preço precisa ser maior que zero; estoque, inteiro e não negativo.
export function temValorInvalido(mudanca: AlteracaoProduto): boolean {
  const precoInvalido = mudanca.preco !== undefined && !(mudanca.preco > 0);
  const estoqueInvalido =
    mudanca.quantidade !== undefined && !(Number.isInteger(mudanca.quantidade) && mudanca.quantidade >= 0);
  return precoInvalido || estoqueInvalido;
}

export default function ResumoEdicaoLote({
  produtos,
  mudancas,
}: {
  produtos: Produto[];
  mudancas: AlteracaoProduto[];
}) {
  return (
    <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto text-sm">
      {mudancas.map((mudanca) => {
        const produto = produtos.find((p) => p.id === mudanca.id);
        if (!produto) return null;

        return (
          <li key={mudanca.id} className="py-2">
            <p className="font-medium text-slate-900">{produto.nome}</p>
            <ul className="mt-1 space-y-0.5 text-slate-600">
              {mudanca.preco !== undefined && (
                <li>
                  Preço: {formatPrice.format(produto.preco)} → <strong>{formatPrice.format(mudanca.preco)}</strong>
                </li>
              )}
              {mudanca.quantidade !== undefined && (
                <li>
                  Estoque: {produto.quantidade} → <strong>{mudanca.quantidade}</strong>
                </li>
              )}
              {mudanca.somarEstoque !== undefined && (
                <li>
                  Estoque: {produto.quantidade} → <strong>{produto.quantidade + mudanca.somarEstoque}</strong> (+
                  {mudanca.somarEstoque})
                </li>
              )}
              {mudanca.ativo !== undefined && (
                <li>
                  Status: {produto.ativo ? "Ativo" : "Inativo"} → <strong>{mudanca.ativo ? "Ativo" : "Inativo"}</strong>
                </li>
              )}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

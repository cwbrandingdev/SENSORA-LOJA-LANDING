"use client";

// Coleções de datas festivas (Natal, Páscoa...): criadas uma vez e
// ligadas/desligadas a cada ano. Ligada, aparece no menu da loja e em
// /colecoes/<slug>. Os produtos da coleção são cadastrados no mesmo painel,
// com o formulário da tela de Produtos.
import { useEffect, useState } from "react";
import Image from "next/image";
import { Gift, Pencil, Trash2 } from "lucide-react";
import PainelLateral from "@/components/admin/PainelLateral";
import ColecaoForm from "@/components/forms/ColecaoForm";
import ProductForm, { produtoFormParaPayload, type ProductFormValues } from "@/components/forms/ProductForm";
import EmptyState from "@/components/ui/EmptyState";
import FormButton from "@/components/ui/FormButton";
import InlineErrorState from "@/components/ui/InlineErrorState";
import TableSkeleton from "@/components/ui/TableSkeleton";
import { useToast } from "@/context/ToastContext";
import { getErrorMessage } from "@/lib/errors";
import { revalidarColecoes, revalidarProdutos } from "@/lib/actions";
import { atualizarColecao, criarColecao, listarColecoes, removerColecao } from "@/services/colecoes";
import { listarCategorias } from "@/services/categorias";
import { atualizarProduto, criarProduto, listarProdutos } from "@/services/produtos";
import type { Categoria, Colecao, ColecaoPayload, Produto } from "@/lib/types/loja";

export default function ColecoesPage() {
  const toast = useToast();
  const [colecoes, setColecoes] = useState<Colecao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [editando, setEditando] = useState<Colecao | undefined>(undefined);
  const [showForm, setShowForm] = useState(false);
  // Produto aberto no formulário de produto dentro do painel ("novo" = cadastrando).
  const [produtoNoForm, setProdutoNoForm] = useState<Produto | "novo" | null>(null);

  const produtosDaColecao = editando ? produtos.filter((p) => editando.produtoIds.includes(p.id)) : [];

  async function carregar() {
    setLoading(true);
    setErro(null);
    try {
      const [listaColecoes, listaProdutos, listaCategorias] = await Promise.all([
        listarColecoes(),
        listarProdutos(),
        listarCategorias(),
      ]);
      setColecoes(listaColecoes);
      setProdutos(listaProdutos);
      setCategorias(listaCategorias);
    } catch (err) {
      const mensagem = getErrorMessage(err, "Não foi possível carregar as coleções.");
      toast.error(mensagem);
      setErro(mensagem);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function abrirNova() {
    setEditando(undefined);
    setShowForm(true);
  }

  function abrirEdicao(colecao: Colecao) {
    setEditando(colecao);
    setShowForm(true);
  }

  function fecharForm() {
    setShowForm(false);
    setEditando(undefined);
    setProdutoNoForm(null);
  }

  // Esc/clique fora: com o formulário de produto aberto, volta para a coleção.
  function fecharPainel() {
    if (produtoNoForm) {
      setProdutoNoForm(null);
    } else {
      fecharForm();
    }
  }

  async function handleSubmit(data: ColecaoPayload) {
    try {
      if (editando) {
        await atualizarColecao(editando.id, data);
        toast.success("Coleção atualizada.");
        fecharForm();
      } else {
        // Painel continua aberto, já em edição, para cadastrar os produtos.
        setEditando(await criarColecao(data));
        toast.success("Coleção criada. Agora cadastre os produtos dela.");
      }
      await Promise.all([carregar(), revalidarColecoes()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar a coleção."));
    }
  }

  async function salvarProduto(data: ProductFormValues) {
    if (!editando) return;
    const payload = produtoFormParaPayload(data);
    try {
      if (produtoNoForm === "novo") {
        const novo = await criarProduto(payload);
        const produtoIds = [...editando.produtoIds, novo.id];
        setEditando(await atualizarColecao(editando.id, { produtoIds }));
        toast.success(`"${novo.nome}" cadastrado na coleção.`);
      } else if (produtoNoForm) {
        await atualizarProduto(produtoNoForm.id, payload);
        toast.success("Produto atualizado.");
      }
      setProdutoNoForm(null);
      await Promise.all([carregar(), revalidarProdutos(), revalidarColecoes()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível salvar o produto."));
    }
  }

  // Só tira da coleção: o produto continua cadastrado na tela de Produtos.
  async function tirarProduto(produto: Produto) {
    if (!editando) return;
    if (!window.confirm(`Tirar "${produto.nome}" desta coleção? O produto continua cadastrado.`)) {
      return;
    }
    try {
      const produtoIds = editando.produtoIds.filter((id) => id !== produto.id);
      setEditando(await atualizarColecao(editando.id, { produtoIds }));
      await Promise.all([carregar(), revalidarColecoes()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível tirar o produto da coleção."));
    }
  }

  async function alternarAtivo(colecao: Colecao) {
    try {
      await atualizarColecao(colecao.id, { ativo: !colecao.ativo });
      toast.success(colecao.ativo ? `"${colecao.nome}" saiu da loja.` : `"${colecao.nome}" está na loja.`);
      await Promise.all([carregar(), revalidarColecoes()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível alterar a coleção."));
    }
  }

  async function remover(colecao: Colecao) {
    if (!window.confirm(`Excluir a coleção "${colecao.nome}"? Os produtos continuam na loja.`)) {
      return;
    }
    try {
      await removerColecao(colecao.id);
      toast.success("Coleção excluída.");
      await Promise.all([carregar(), revalidarColecoes()]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Não foi possível excluir a coleção."));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-brand-navy">Coleções</h2>
          <p className="text-sm text-slate-500">Datas festivas: ligue perto da data e desligue depois.</p>
        </div>
        <FormButton variant="primary" onClick={abrirNova}>
          Nova coleção
        </FormButton>
      </div>

      {showForm && (
        <PainelLateral rotulo="Formulário de coleção" onFechar={fecharPainel}>
          {/* Escondido (não desmontado) enquanto o produto está aberto, para
              não perder o que já foi digitado na coleção. */}
          <div className={produtoNoForm ? "hidden" : ""}>
            <ColecaoForm
              key={editando?.id ?? "nova"}
              initialData={editando}
              produtosDaColecao={produtosDaColecao}
              categorias={categorias}
              onSubmit={handleSubmit}
              onCancel={fecharForm}
              onNovoProduto={() => setProdutoNoForm("novo")}
              onEditarProduto={setProdutoNoForm}
              onTirarProduto={tirarProduto}
            />
          </div>

          {produtoNoForm && editando && (
            <div className="flex flex-col gap-3">
              <p className="text-sm font-semibold text-brand-navy">
                {produtoNoForm === "novo"
                  ? `Novo produto em "${editando.nome}"`
                  : `Editar produto de "${editando.nome}"`}
              </p>
              <ProductForm
                key={produtoNoForm === "novo" ? "novo" : produtoNoForm.id}
                initialData={produtoNoForm === "novo" ? undefined : produtoNoForm}
                categorias={categorias}
                onSubmit={salvarProduto}
                onCancel={() => setProdutoNoForm(null)}
              />
            </div>
          )}
        </PainelLateral>
      )}

      {loading && colecoes.length === 0 ? (
        <TableSkeleton rows={3} columns={4} />
      ) : erro ? (
        <InlineErrorState message={erro} onRetry={carregar} />
      ) : colecoes.length === 0 ? (
        <EmptyState
          compact
          eyebrow="Coleções"
          title="Nenhuma coleção ainda"
          message="Crie a primeira, por exemplo Natal ou Páscoa."
          icon={Gift}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {colecoes.map((colecao) => (
            <li
              key={colecao.id}
              className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-md bg-slate-100">
                {colecao.imagemUrl ? (
                  <Image src={colecao.imagemUrl} alt="" fill sizes="80px" className="object-cover" />
                ) : (
                  <Gift className="absolute inset-0 m-auto h-5 w-5 text-slate-400" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{colecao.nome}</p>
                <p className="text-xs text-slate-500">
                  {colecao.produtoIds.length} produto(s) · /colecoes/{colecao.slug}
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={colecao.ativo}
                onClick={() => alternarAtivo(colecao)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  colecao.ativo
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                    : "bg-slate-100 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-200"
                }`}
              >
                {colecao.ativo ? "Ativa · desligar" : "Desligada · ligar"}
              </button>

              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => abrirEdicao(colecao)}
                  aria-label={`Editar ${colecao.nome}`}
                  className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remover(colecao)}
                  aria-label={`Excluir ${colecao.nome}`}
                  className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

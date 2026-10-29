"use client";

// Criar/editar uma coleção de data festiva: nome, texto, foto de capa e
// ligada ou não. Os produtos da coleção são cadastrados/editados com o
// mesmo formulário da tela de Produtos (ver app/workspace-x/colecoes).
import { useState } from "react";
import Image from "next/image";
import { Pencil, Plus, Upload, X } from "lucide-react";
import FormButton from "@/components/ui/FormButton";
import { enviarParaImageKit } from "@/components/forms/ImageUploader";
import { ProductThumb } from "@/components/tables/ProductTable";
import type { Categoria, Colecao, ColecaoPayload, Produto } from "@/lib/types/loja";

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";

type Props = {
  initialData?: Colecao;
  /** Produtos que já estão na coleção. */
  produtosDaColecao: Produto[];
  categorias: Categoria[];
  onSubmit: (data: ColecaoPayload) => Promise<void>;
  onCancel: () => void;
  onNovoProduto: () => void;
  onEditarProduto: (produto: Produto) => void;
  onTirarProduto: (produto: Produto) => void;
};

export default function ColecaoForm({
  initialData,
  produtosDaColecao,
  categorias,
  onSubmit,
  onCancel,
  onNovoProduto,
  onEditarProduto,
  onTirarProduto,
}: Props) {
  const [nome, setNome] = useState(initialData?.nome ?? "");
  const [titulo, setTitulo] = useState(initialData?.titulo ?? "");
  const [descricao, setDescricao] = useState(initialData?.descricao ?? "");
  const [imagemUrl, setImagemUrl] = useState(initialData?.imagemUrl ?? "");
  const [ativo, setAtivo] = useState(initialData?.ativo ?? false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  function nomeCategoria(produto: Produto): string {
    return categorias.find((c) => c.id === produto.categoriaId)?.nome ?? "Sem categoria";
  }

  async function enviarFoto(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo) return;

    setErro("");
    setEnviandoFoto(true);
    try {
      setImagemUrl(await enviarParaImageKit(arquivo, nome || "colecao"));
    } catch {
      setErro("Não foi possível enviar a foto. Tente de novo.");
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function salvar(event: React.FormEvent) {
    event.preventDefault();
    if (!nome.trim()) {
      setErro("Nome é obrigatório.");
      return;
    }

    setErro("");
    setSalvando(true);
    try {
      await onSubmit({
        nome: nome.trim(),
        titulo: titulo.trim(),
        descricao: descricao.trim(),
        imagemUrl,
        ativo,
      });
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={salvar} className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-brand-navy">{initialData ? "Editar coleção" : "Nova coleção"}</h3>

      <div className="flex flex-col gap-1">
        <label htmlFor="colecao-nome" className={labelClass}>
          Nome no menu
        </label>
        <input
          id="colecao-nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Natal"
          className={inputClass}
        />
        <p className="text-xs text-slate-500">Curto: aparece no menu do site e nesta lista do Admin.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="colecao-titulo" className={labelClass}>
          Título da página <span className="font-normal text-slate-500">(opcional)</span>
        </label>
        <input
          id="colecao-titulo"
          type="text"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder={nome || "Ex.: Coleção Noite Feliz"}
          maxLength={150}
          className={inputClass}
        />
        <p className="text-xs text-slate-500">Título grande na página da coleção. Vazio = usa o nome do menu.</p>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="colecao-descricao" className={labelClass}>
          Texto da página
        </label>
        <textarea
          id="colecao-descricao"
          rows={3}
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Ex.: Presentes que perfumam a noite mais especial do ano."
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className={labelClass}>Foto de capa</span>
        {imagemUrl ? (
          <div className="relative aspect-16/7 overflow-hidden rounded-md bg-slate-100">
            <Image src={imagemUrl} alt="Capa da coleção" fill sizes="480px" className="object-cover" />
            <button
              type="button"
              onClick={() => setImagemUrl("")}
              aria-label="Remover foto"
              className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-600 shadow hover:bg-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 px-3 py-6 text-sm text-slate-500 hover:bg-slate-50">
            <Upload className="h-4 w-4" />
            {enviandoFoto ? "Enviando..." : "Escolher foto"}
            <input type="file" accept="image/*" className="sr-only" onChange={enviarFoto} disabled={enviandoFoto} />
          </label>
        )}
      </div>

      <label className="flex items-center gap-3 rounded-md bg-slate-50 px-3 py-3 text-sm">
        <input
          type="checkbox"
          checked={ativo}
          onChange={(e) => setAtivo(e.target.checked)}
          className="h-4 w-4 accent-brand-navy"
        />
        <span>
          <strong className="font-semibold text-brand-navy">Ativa na loja</strong>
          <span className="block text-xs text-slate-500">Aparece no menu do site enquanto estiver marcada.</span>
        </span>
      </label>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className={labelClass}>
            Produtos da coleção <span className="font-normal text-slate-500">({produtosDaColecao.length})</span>
          </span>
          {initialData && (
            <button
              type="button"
              onClick={onNovoProduto}
              className="inline-flex items-center gap-1 rounded-md bg-brand-navy px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-navy/90"
            >
              <Plus className="h-3.5 w-3.5" />
              Novo produto
            </button>
          )}
        </div>

        {!initialData ? (
          <p className="rounded-md bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
            Crie a coleção primeiro. Depois é só cadastrar os produtos dela aqui.
          </p>
        ) : produtosDaColecao.length === 0 ? (
          <p className="rounded-md bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
            Nenhum produto ainda. Clique em &quot;Novo produto&quot;.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-md border border-slate-200 bg-white">
            {produtosDaColecao.map((produto) => (
              <li key={produto.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <ProductThumb key={produto.imagemUrl ?? "sem-imagem"} src={produto.imagemUrl} alt={produto.nome} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">{produto.nome}</span>
                  <span className="block truncate text-xs text-slate-500">
                    {nomeCategoria(produto)}
                    {!produto.ativo && " · inativo"}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => onEditarProduto(produto)}
                  aria-label={`Editar ${produto.nome}`}
                  className="rounded-md p-2 text-slate-500 hover:bg-slate-100"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onTirarProduto(produto)}
                  aria-label={`Tirar ${produto.nome} da coleção`}
                  title="Tirar da coleção"
                  className="rounded-md p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">Produtos inativos ficam escondidos na loja mesmo dentro da coleção.</p>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <div className="flex gap-2">
        <FormButton type="submit" variant="primary" disabled={salvando || enviandoFoto}>
          {initialData ? "Salvar edição" : "Criar coleção"}
        </FormButton>
        <FormButton type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </FormButton>
      </div>
    </form>
  );
}

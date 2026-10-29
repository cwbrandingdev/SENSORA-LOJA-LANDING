"use client";

// Criar/editar uma coleção de data festiva: nome, texto, foto de capa,
// ligada ou não, e quais produtos entram nela.
import { useMemo, useState } from "react";
import Image from "next/image";
import { Search, Upload, X } from "lucide-react";
import FormButton from "@/components/ui/FormButton";
import { enviarParaImageKit } from "@/components/forms/ImageUploader";
import type { Colecao, ColecaoPayload, Produto } from "@/lib/types/loja";

const inputClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy";
const labelClass = "text-sm font-medium text-slate-700";

type Props = {
  initialData?: Colecao;
  produtos: Produto[];
  onSubmit: (data: ColecaoPayload) => Promise<void>;
  onCancel: () => void;
};

export default function ColecaoForm({ initialData, produtos, onSubmit, onCancel }: Props) {
  const [nome, setNome] = useState(initialData?.nome ?? "");
  const [descricao, setDescricao] = useState(initialData?.descricao ?? "");
  const [imagemUrl, setImagemUrl] = useState(initialData?.imagemUrl ?? "");
  const [ativo, setAtivo] = useState(initialData?.ativo ?? false);
  const [produtoIds, setProdutoIds] = useState<number[]>(initialData?.produtoIds ?? []);
  const [busca, setBusca] = useState("");
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const produtosVisiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return produtos.filter((p) => p.nome.toLowerCase().includes(termo));
  }, [produtos, busca]);

  function alternarProduto(id: number) {
    if (produtoIds.includes(id)) {
      setProdutoIds(produtoIds.filter((produtoId) => produtoId !== id));
    } else {
      setProdutoIds([...produtoIds, id]);
    }
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
        descricao: descricao.trim(),
        imagemUrl,
        ativo,
        produtoIds,
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
          Nome
        </label>
        <input
          id="colecao-nome"
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Natal"
          className={inputClass}
        />
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
          <div className="relative aspect-[16/7] overflow-hidden rounded-md bg-slate-100">
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
        <span className={labelClass}>
          Produtos da coleção <span className="font-normal text-slate-500">({produtoIds.length} escolhidos)</span>
        </span>
        <label className="relative block">
          <span className="sr-only">Buscar produto</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar produto pelo nome"
            className={`w-full pl-9 ${inputClass}`}
          />
        </label>
        <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-md border border-slate-200">
          {produtosVisiveis.map((produto) => (
            <li key={produto.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={produtoIds.includes(produto.id)}
                  onChange={() => alternarProduto(produto.id)}
                  className="h-4 w-4 accent-brand-navy"
                />
                <span className="min-w-0 flex-1 truncate">{produto.nome}</span>
                {!produto.ativo && <span className="text-xs text-slate-400">inativo</span>}
              </label>
            </li>
          ))}
          {produtosVisiveis.length === 0 && (
            <li className="px-3 py-4 text-center text-sm text-slate-500">Nenhum produto encontrado.</li>
          )}
        </ul>
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

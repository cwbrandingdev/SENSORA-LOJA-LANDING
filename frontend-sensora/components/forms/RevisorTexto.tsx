"use client";

// Botão "Revisar texto" abaixo de um campo do formulário de produto: manda o
// texto ao LanguageTool (services/revisor-texto.ts) e lista cada problema
// com a sugestão, para aplicar com um clique. Se o texto mudar depois da
// revisão, as posições deixam de valer e a lista some até revisar de novo.
import { useState } from "react";
import { revisarTexto, type ProblemaTexto } from "@/services/revisor-texto";

type RevisorTextoProps = {
  texto: string;
  onCorrigir: (novoTexto: string) => void;
};

function substituir(texto: string, p: ProblemaTexto, por: string) {
  return texto.slice(0, p.offset) + por + texto.slice(p.offset + p.length);
}

export default function RevisorTexto({ texto, onCorrigir }: RevisorTextoProps) {
  const [revisado, setRevisado] = useState<string | null>(null);
  const [problemas, setProblemas] = useState<ProblemaTexto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const atual = revisado !== null && revisado === texto;

  async function revisar() {
    setCarregando(true);
    setErro("");
    try {
      setProblemas(await revisarTexto(texto));
      setRevisado(texto);
    } catch {
      setErro("Não foi possível revisar agora. Tente de novo em instantes.");
    } finally {
      setCarregando(false);
    }
  }

  function aplicar(escolhidos: ProblemaTexto[]) {
    if (revisado === null) return;
    // Do fim para o começo: trocar um trecho não muda a posição dos anteriores.
    const ordenados = [...escolhidos].sort((a, b) => b.offset - a.offset);
    const novo = ordenados.reduce((t, p) => substituir(t, p, p.sugestao ?? ""), revisado);
    const restantes = problemas
      .filter((p) => !escolhidos.includes(p))
      .map((p) => {
        const deslocamento = escolhidos
          .filter((e) => e.offset < p.offset)
          .reduce((soma, e) => soma + (e.sugestao ?? "").length - e.length, 0);
        return { ...p, offset: p.offset + deslocamento };
      });
    setProblemas(restantes);
    setRevisado(novo);
    onCorrigir(novo);
  }

  const comSugestao = problemas.filter((p) => p.sugestao !== null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={revisar}
          disabled={carregando || !texto.trim()}
          className="text-xs font-medium text-brand-navy underline underline-offset-4 hover:text-brand-orange disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
        >
          {carregando ? "Revisando…" : "Revisar texto"}
        </button>
        {atual && problemas.length === 0 && (
          <span className="text-xs text-emerald-700">✓ Nenhum erro encontrado.</span>
        )}
        {atual && comSugestao.length > 1 && (
          <button
            type="button"
            onClick={() => aplicar(comSugestao)}
            className="text-xs font-medium text-brand-orange underline underline-offset-4"
          >
            Aplicar todas ({comSugestao.length})
          </button>
        )}
      </div>

      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {atual && problemas.length > 0 && (
        <ul className="flex flex-col divide-y divide-slate-100 rounded-md border border-amber-200 bg-amber-50/60 text-xs">
          {problemas.map((p) => (
            <li key={`${p.offset}-${p.length}`} className="flex items-start gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-slate-800">
                  <span className="font-medium text-red-700 line-through">
                    {texto.slice(p.offset, p.offset + p.length) || "(espaço)"}
                  </span>
                  {p.sugestao !== null && (
                    <>
                      {" → "}
                      <span className="font-medium text-emerald-700">{p.sugestao || "(remover)"}</span>
                    </>
                  )}
                </p>
                <p className="mt-0.5 text-slate-500">{p.mensagem}</p>
              </div>
              {p.sugestao !== null && (
                <button
                  type="button"
                  onClick={() => aplicar([p])}
                  className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 font-medium text-brand-navy hover:border-brand-navy"
                >
                  Aplicar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

"use client";

// Etapa 5 (Evidências) — fotos opcionais de uma devolução já criada. O
// cliente escolhe as fotos (com prévia), envia uma por vez e pode remover
// qualquer uma enquanto a devolução aguarda análise. Formato, tamanho,
// limite e dono são sempre conferidos de novo no backend — as checagens
// daqui só evitam um envio que certamente seria recusado.
import { useEffect, useRef, useState } from "react";
import FormButton from "@/components/ui/FormButton";
import { getErrorMessage } from "@/lib/errors";
import {
  buscarMinhaDevolucao,
  enviarEvidenciaDevolucao,
  removerEvidenciaDevolucao,
} from "@/services/pedidos";

const MAXIMO_FOTOS = 5;
const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024;
const TIPOS_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"];

type Foto = {
  chave: string;
  preview: string;
  arquivo?: File; // só enquanto ainda não foi enviada
  evidenciaId?: number; // depois de enviada
  status: "pendente" | "enviando" | "enviada" | "erro";
  erro?: string;
};

type EvidenciasDevolucaoProps = {
  pedidoId: number;
  devolucaoId: number;
  onConcluir: () => void;
};

// Mesmo visual do botão de seleção do ImageUploader (Admin).
const botaoSelecionarClass =
  "inline-flex w-fit cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100";

export default function EvidenciasDevolucao({
  pedidoId,
  devolucaoId,
  onConcluir,
}: EvidenciasDevolucaoProps) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const previewsCriadas = useRef<string[]>([]);

  // Fotos que já estão na devolução (ex.: tela reaberta logo depois).
  useEffect(() => {
    buscarMinhaDevolucao(pedidoId, devolucaoId)
      .then((devolucao) =>
        setFotos(
          devolucao.evidencias.map((evidencia) => ({
            chave: `evidencia-${evidencia.id}`,
            preview: evidencia.url,
            evidenciaId: evidencia.id,
            status: "enviada",
          })),
        ),
      )
      .catch(() => {
        // Sem a lista, o cliente ainda pode adicionar fotos normalmente.
      });
  }, [pedidoId, devolucaoId]);

  // Libera as prévias locais (URL.createObjectURL) ao sair da tela.
  useEffect(() => {
    const previews = previewsCriadas.current;
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  function handleSelecionar(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivos = Array.from(event.target.files ?? []);
    // Permite escolher o mesmo arquivo de novo depois de removê-lo.
    event.target.value = "";

    const vagas = MAXIMO_FOTOS - fotos.length;
    const recusadas: string[] = [];
    const novas: Foto[] = [];

    for (const arquivo of arquivos) {
      if (!TIPOS_PERMITIDOS.includes(arquivo.type)) {
        recusadas.push(`${arquivo.name}: use JPEG, PNG ou WEBP`);
      } else if (arquivo.size > TAMANHO_MAXIMO_BYTES) {
        recusadas.push(`${arquivo.name}: máximo de 5 MB`);
      } else if (novas.length >= vagas) {
        recusadas.push(`${arquivo.name}: limite de ${MAXIMO_FOTOS} fotos`);
      } else {
        const preview = URL.createObjectURL(arquivo);
        previewsCriadas.current.push(preview);
        novas.push({
          chave: `${arquivo.name}-${arquivo.lastModified}-${preview}`,
          preview,
          arquivo,
          status: "pendente",
        });
      }
    }

    setAviso(recusadas.length > 0 ? `Não adicionadas: ${recusadas.join("; ")}.` : null);
    setFotos((atuais) => [...atuais, ...novas]);
  }

  function atualizarFoto(chave: string, mudancas: Partial<Foto>) {
    setFotos((atuais) =>
      atuais.map((foto) => (foto.chave === chave ? { ...foto, ...mudancas } : foto)),
    );
  }

  // Envia uma por vez as que ainda não foram (inclusive as que deram erro).
  // Uma falha não afeta as outras nem as que já foram enviadas.
  async function handleEnviar() {
    const aEnviar = fotos.filter(
      (foto) => foto.arquivo && (foto.status === "pendente" || foto.status === "erro"),
    );
    setEnviando(true);
    setAviso(null);

    for (const foto of aEnviar) {
      atualizarFoto(foto.chave, { status: "enviando", erro: undefined });
      try {
        const evidencia = await enviarEvidenciaDevolucao(pedidoId, devolucaoId, foto.arquivo!);
        atualizarFoto(foto.chave, {
          status: "enviada",
          evidenciaId: evidencia.id,
          arquivo: undefined,
        });
      } catch (err) {
        atualizarFoto(foto.chave, {
          status: "erro",
          erro: getErrorMessage(err, "Não foi possível enviar esta foto."),
        });
      }
    }

    setEnviando(false);
  }

  async function handleRemover(foto: Foto) {
    if (foto.evidenciaId !== undefined) {
      try {
        await removerEvidenciaDevolucao(pedidoId, devolucaoId, foto.evidenciaId);
      } catch (err) {
        setAviso(getErrorMessage(err, "Não foi possível remover a foto. Tente novamente."));
        return;
      }
    }
    setFotos((atuais) => atuais.filter((atual) => atual.chave !== foto.chave));
  }

  const temParaEnviar = fotos.some(
    (foto) => foto.status === "pendente" || foto.status === "erro",
  );
  const algumaEnviada = fotos.some((foto) => foto.status === "enviada");

  return (
    <section
      aria-labelledby="fotos-devolucao-titulo"
      className="mt-6 rounded-lg border border-slate-200 p-4 sm:p-6"
    >
      <h2 id="fotos-devolucao-titulo" className="font-serif text-lg font-normal text-brand-navy">
        Fotos da devolução (opcional)
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Se quiser, envie até {MAXIMO_FOTOS} fotos do produto (JPEG, PNG ou WEBP, até 5 MB
        cada). Elas ajudam na análise.
      </p>

      {fotos.length > 0 && (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {fotos.map((foto) => (
            <li key={foto.chave} className="flex flex-col gap-1">
              <div className="aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={foto.preview}
                  alt="Foto da devolução"
                  className="h-full w-full object-cover"
                />
              </div>
              <p
                className={`text-xs ${foto.status === "erro" ? "text-red-600" : "text-slate-500"}`}
              >
                {foto.status === "pendente" && "Pronta para enviar"}
                {foto.status === "enviando" && "Enviando..."}
                {foto.status === "enviada" && "Enviada"}
                {foto.status === "erro" && foto.erro}
              </p>
              <button
                type="button"
                onClick={() => handleRemover(foto)}
                disabled={enviando}
                className="w-fit text-xs text-slate-500 underline underline-offset-2 hover:text-slate-700 disabled:opacity-50"
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}

      {aviso && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {aviso}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {fotos.length < MAXIMO_FOTOS && (
          <label
            className={`${botaoSelecionarClass} ${enviando ? "pointer-events-none opacity-50" : ""}`}
          >
            Adicionar fotos
            <input
              type="file"
              accept={TIPOS_PERMITIDOS.join(",")}
              multiple
              className="hidden"
              disabled={enviando}
              onChange={handleSelecionar}
            />
          </label>
        )}
        <FormButton type="button" onClick={handleEnviar} disabled={!temParaEnviar || enviando}>
          {enviando ? "Enviando..." : "Enviar fotos"}
        </FormButton>
        <FormButton type="button" variant="ghost" onClick={onConcluir} disabled={enviando}>
          {algumaEnviada ? "Concluir" : "Continuar sem fotos"}
        </FormButton>
      </div>
    </section>
  );
}

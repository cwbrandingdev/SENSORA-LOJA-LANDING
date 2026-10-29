"use client";

// Galeria de fotos do produto. Upload direto do navegador para o ImageKit
// (arquivo nunca passa pelo nosso backend — só as credenciais de GET
// /imagekit/auth passam por lá), um arquivo de cada vez, sem processamento
// (sem canvas, sem resize, sem recompressão). A ordem da lista é a ordem da
// loja e a 1ª foto é a capa: as setas reordenam e "Capa" leva a foto para o
// começo. O backend repete a regra (imagemUrl = imagens[0]). A 2ª foto é a
// que os cartões da loja mostram no hover (ver segundaImagemDaGaleria).
// Clicar numa miniatura abre a foto ampliada (PreviewFoto).
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, MousePointer2, Plus, Star, Trash2, X } from "lucide-react";
import { obterAutenticacaoImageKit } from "@/services/imagekit";

const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGEKIT_FOLDER = "/sensora/products";
// Mesmo limite do backend (MAXIMO_IMAGENS_PRODUTO).
export const MAXIMO_IMAGENS = 8;
// Mesma regra do schema do ProductForm e do backend.
const URL_IMAGEM_VALIDA = /^(https?:\/\/|\/)/;

type ImageUploaderProps = {
  /** Fotos na ordem da loja — URLs do ImageKit ou caminhos locais (/images/...). */
  value: string[];
  onChange: (urls: string[]) => void;
  /** Usado só para compor um nome de arquivo legível; produto pode ainda não existir no banco. */
  nomeProduto?: string;
};

// Sem lib de slugify — nome do produto vira um trecho seguro do nome do
// arquivo, sempre com timestamp para evitar colisão (o produto pode nem
// existir no banco ainda no momento do upload).
function nomeArquivoSeguro(nomeProduto: string | undefined, file: File): string {
  const pontoIndex = file.name.lastIndexOf(".");
  const extensao = pontoIndex >= 0 ? file.name.slice(pontoIndex) : "";
  const base = (nomeProduto || "produto")
    .normalize("NFD")
    .replace(new RegExp("[̀-ͯ]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "")
    .slice(0, 60);

  return `${base || "produto"}-${Date.now()}${extensao}`;
}

// Cada envio pede credenciais novas: o token do ImageKit vale para um upload só.
export async function enviarParaImageKit(file: File, nomeProduto?: string): Promise<string> {
  const auth = await obterAutenticacaoImageKit();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("fileName", nomeArquivoSeguro(nomeProduto, file));
  formData.append("publicKey", auth.publicKey);
  formData.append("signature", auth.signature);
  formData.append("expire", String(auth.expire));
  formData.append("token", auth.token);
  formData.append("folder", IMAGEKIT_FOLDER);
  formData.append("useUniqueFileName", "true");

  const response = await fetch(IMAGEKIT_UPLOAD_URL, { method: "POST", body: formData });
  if (!response.ok) {
    throw new Error("Upload para o ImageKit falhou");
  }
  const data = (await response.json()) as { url?: string };
  if (!data.url) {
    throw new Error("Resposta do ImageKit sem URL");
  }
  return data.url;
}

function mover(lista: string[], de: number, para: number): string[] {
  const nova = [...lista];
  const [foto] = nova.splice(de, 1);
  nova.splice(para, 0, foto);
  return nova;
}

const botaoIcone =
  "flex h-7 w-7 items-center justify-center rounded bg-white/90 text-slate-700 shadow-sm hover:bg-white hover:text-brand-navy disabled:cursor-not-allowed disabled:opacity-30";

const botaoPapel =
  "inline-flex items-center justify-center gap-1 rounded border px-1 py-1 text-[10px] font-semibold uppercase tracking-wider disabled:cursor-default";

const botaoPreview =
  "flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 disabled:opacity-30";

// Foto ampliada por cima de tudo. Fecha no X, clicando fora ou com Esc; as
// setas (na tela e no teclado) passam entre as fotos.
function PreviewFoto({
  fotos,
  indice,
  onIndice,
  onFechar,
}: {
  fotos: string[];
  indice: number;
  onIndice: (indice: number) => void;
  onFechar: () => void;
}) {
  const anterior = indice > 0 ? indice - 1 : null;
  const proxima = indice < fotos.length - 1 ? indice + 1 : null;

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") {
        // Captura + stopImmediatePropagation: o Esc fecha só o preview, não
        // o painel do formulário (que também escuta Esc na window).
        e.stopImmediatePropagation();
        onFechar();
      }
      if (e.key === "ArrowLeft" && anterior !== null) onIndice(anterior);
      if (e.key === "ArrowRight" && proxima !== null) onIndice(proxima);
    }
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [anterior, proxima, onIndice, onFechar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${indice + 1} de ${fotos.length}`}
      className="fixed inset-0 z-60 flex items-center justify-center gap-3 bg-slate-950/85 p-4"
      onClick={onFechar}
    >
      <button
        type="button"
        onClick={onFechar}
        aria-label="Fechar"
        className="absolute right-4 top-4 rounded-full p-2 text-white hover:bg-white/10"
      >
        <X className="h-5 w-5" />
      </button>
      <button
        type="button"
        className={botaoPreview}
        disabled={anterior === null}
        onClick={(e) => {
          e.stopPropagation();
          if (anterior !== null) onIndice(anterior);
        }}
        aria-label="Foto anterior"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <figure className="flex min-w-0 flex-col items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={fotos[indice]}
          alt={`Foto ${indice + 1} do produto`}
          className="max-h-[80vh] max-w-full rounded-md object-contain"
        />
        <figcaption className="text-xs text-white/70">
          {indice + 1} de {fotos.length}
          {indice === 0 && " · Capa"}
          {indice === 1 && " · Hover"}
        </figcaption>
      </figure>
      <button
        type="button"
        className={botaoPreview}
        disabled={proxima === null}
        onClick={(e) => {
          e.stopPropagation();
          if (proxima !== null) onIndice(proxima);
        }}
        aria-label="Próxima foto"
      >
        <ArrowRight className="h-5 w-5" />
      </button>
    </div>
  );
}

export default function ImageUploader({ value, onChange, nomeProduto }: ImageUploaderProps) {
  const [ampliada, setAmpliada] = useState<number | null>(null);
  const [enviando, setEnviando] = useState("");
  const [erro, setErro] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [urlManual, setUrlManual] = useState("");
  const vagas = MAXIMO_IMAGENS - value.length;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selecionados = Array.from(event.target.files ?? []);
    // Permite selecionar os mesmos arquivos de novo (ex.: depois de um erro).
    event.target.value = "";
    if (selecionados.length === 0) return;

    setErro("");
    const invalido = selecionados.find(
      (file) => !file.type.startsWith("image/") || file.size > MAX_FILE_SIZE_BYTES,
    );
    if (invalido) {
      setErro(`"${invalido.name}" não foi enviada: use imagens de até 10 MB.`);
      return;
    }
    const arquivos = selecionados.slice(0, vagas);
    if (selecionados.length > vagas) {
      setErro(`Só cabem ${MAXIMO_IMAGENS} fotos: ${selecionados.length - vagas} ficaram de fora.`);
    }

    let urls = value;
    for (const [indice, file] of arquivos.entries()) {
      setEnviando(`Enviando ${indice + 1} de ${arquivos.length}...`);
      try {
        urls = [...urls, await enviarParaImageKit(file, nomeProduto)];
        onChange(urls);
      } catch {
        setErro("Não foi possível enviar a imagem. Tente novamente.");
        break;
      }
    }
    setEnviando("");
  }

  function adicionarUrlManual() {
    const url = urlManual.trim();
    if (!URL_IMAGEM_VALIDA.test(url)) {
      setErro("Informe uma URL válida (http(s) ou caminho começando com /)");
      return;
    }
    setErro("");
    onChange([...value, url]);
    setUrlManual("");
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {value.map((url, indice) => (
          <li key={`${url}-${indice}`} className="flex flex-col gap-1.5">
            <div className="relative aspect-square overflow-hidden rounded-md border border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={() => setAmpliada(indice)}
                aria-label={`Ampliar foto ${indice + 1}`}
                className="block h-full w-full cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Foto ${indice + 1} do produto`} className="h-full w-full object-cover" />
              </button>
              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1">
                <button
                  type="button"
                  className={botaoIcone}
                  disabled={indice === 0}
                  onClick={() => onChange(mover(value, indice, indice - 1))}
                  aria-label={`Mover foto ${indice + 1} para a esquerda`}
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className={botaoIcone}
                  onClick={() => onChange(value.filter((_, i) => i !== indice))}
                  aria-label={`Remover foto ${indice + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className={botaoIcone}
                  disabled={indice === value.length - 1}
                  onClick={() => onChange(mover(value, indice, indice + 1))}
                  aria-label={`Mover foto ${indice + 1} para a direita`}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {/* Abaixo da foto: a opção ativa fica preenchida. A capa não pode
                ser também a foto do hover. */}
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                disabled={indice === 0}
                onClick={() => onChange(mover(value, indice, 0))}
                className={`${botaoPapel} ${indice === 0 ? "border-brand-navy bg-brand-navy text-white" : "border-slate-200 text-slate-500 hover:border-brand-navy hover:text-brand-navy"}`}
              >
                <Star className={`h-3 w-3 ${indice === 0 ? "fill-current" : ""}`} aria-hidden />
                Capa
              </button>
              <button
                type="button"
                disabled={indice <= 1}
                onClick={() => onChange(mover(value, indice, 1))}
                className={`${botaoPapel} ${indice === 1 ? "border-brand-orange bg-brand-orange text-white" : "border-slate-200 text-slate-500 enabled:hover:border-brand-orange enabled:hover:text-brand-orange disabled:opacity-30"}`}
              >
                <MousePointer2 className={`h-3 w-3 ${indice === 1 ? "fill-current" : ""}`} aria-hidden />
                Hover
              </button>
            </div>
          </li>
        ))}

        {vagas > 0 && (
          <li>
            <label
              className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-slate-300 text-xs text-slate-500 transition-colors hover:border-brand-navy hover:text-brand-navy ${enviando ? "pointer-events-none opacity-50" : ""}`}
            >
              <Plus className="h-5 w-5" />
              Adicionar fotos
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={Boolean(enviando)}
                onChange={handleFileChange}
              />
            </label>
          </li>
        )}
      </ul>

      <p className="text-xs text-slate-500">
        {enviando ||
          `Clique numa foto para ampliar. Escolha abaixo de cada foto qual é a capa e qual aparece ao passar o mouse no cartão (Hover). Use as setas para ordenar (até ${MAXIMO_IMAGENS} fotos).`}
      </p>
      {erro && <p className="text-xs text-red-600">{erro}</p>}

      {vagas > 0 && (
        <button
          type="button"
          onClick={() => setManualMode((prev) => !prev)}
          className="w-fit text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
        >
          {manualMode ? "Ocultar URL manual" : "Adicionar por URL"}
        </button>
      )}

      {manualMode && vagas > 0 && (
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="https://..."
            value={urlManual}
            onChange={(event) => setUrlManual(event.target.value)}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
          />
          <button
            type="button"
            onClick={adicionarUrlManual}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Adicionar
          </button>
        </div>
      )}

      {ampliada !== null && value[ampliada] && (
        <PreviewFoto
          fotos={value}
          indice={ampliada}
          onIndice={setAmpliada}
          onFechar={() => setAmpliada(null)}
        />
      )}
    </div>
  );
}

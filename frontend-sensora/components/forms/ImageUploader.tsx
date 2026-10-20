"use client";

// Galeria de fotos do produto. Upload direto do navegador para o ImageKit
// (arquivo nunca passa pelo nosso backend — só as credenciais de GET
// /imagekit/auth passam por lá), um arquivo de cada vez, sem processamento
// (sem canvas, sem resize, sem recompressão). A ordem da lista é a ordem da
// loja e a 1ª foto é a capa: as setas reordenam e "Capa" leva a foto para o
// começo. O backend repete a regra (imagemUrl = imagens[0]). A 2ª foto é a
// que os cartões da loja mostram no hover (ver segundaImagemDaGaleria).
import { useState } from "react";
import { ArrowLeft, ArrowRight, MousePointer2, Plus, Star, Trash2 } from "lucide-react";
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
async function enviarParaImageKit(file: File, nomeProduto?: string): Promise<string> {
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

export default function ImageUploader({ value, onChange, nomeProduto }: ImageUploaderProps) {
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Foto ${indice + 1} do produto`} className="h-full w-full object-cover" />
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
          `Escolha abaixo de cada foto qual é a capa e qual aparece ao passar o mouse no cartão (Hover). Use as setas para ordenar (até ${MAXIMO_IMAGENS} fotos).`}
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
    </div>
  );
}

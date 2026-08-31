"use client";

// Upload direto do navegador para o ImageKit (arquivo nunca passa pelo
// nosso backend — só as credenciais de GET /imagekit/auth passam por lá).
// Envia o File original sem nenhum processamento (sem canvas, sem resize,
// sem recompressão) — a otimização de entrega fica a cargo do CDN do
// ImageKit em uma etapa futura.
import { useEffect, useRef, useState } from "react";
import { obterAutenticacaoImageKit } from "@/services/imagekit";

const IMAGEKIT_UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const IMAGEKIT_FOLDER = "/sensora/products";

type UploadStatus = "idle" | "uploading" | "success" | "error";

type ImageUploaderProps = {
  /** imagemUrl atual — string local (/images/...) ou do ImageKit (https://ik.imagekit.io/...). */
  value?: string;
  onChange: (url: string) => void;
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

const buttonClass =
  "inline-flex w-fit cursor-pointer items-center justify-center rounded-md border border-slate-300 bg-transparent px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100";

export default function ImageUploader({ value, onChange, nomeProduto }: ImageUploaderProps) {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  const previewSrc = localPreview ?? value;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Permite selecionar o mesmo arquivo de novo (ex.: depois de um erro).
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setErrorMessage("Selecione um arquivo de imagem.");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setStatus("error");
      setErrorMessage("A imagem deve ter no máximo 10 MB.");
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }
    const objectUrl = URL.createObjectURL(file);
    objectUrlRef.current = objectUrl;
    setLocalPreview(objectUrl);
    setStatus("uploading");
    setErrorMessage("");

    try {
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

      const response = await fetch(IMAGEKIT_UPLOAD_URL, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload para o ImageKit falhou");
      }

      const data = (await response.json()) as { url?: string };
      if (!data.url) {
        throw new Error("Resposta do ImageKit sem URL");
      }

      onChange(data.url);
      setStatus("success");
    } catch {
      setStatus("error");
      setErrorMessage("Não foi possível enviar a imagem. Tente novamente.");
    }
  }

  function handleManualChange(event: React.ChangeEvent<HTMLInputElement>) {
    setLocalPreview(null);
    setStatus("idle");
    onChange(event.target.value);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4">
        {previewSrc && (
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-slate-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewSrc}
              alt="Pré-visualização da imagem do produto"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className={`${buttonClass} ${status === "uploading" ? "pointer-events-none opacity-50" : ""}`}>
            {previewSrc ? "Trocar imagem" : "Selecionar imagem"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={status === "uploading"}
              onChange={handleFileChange}
            />
          </label>

          {status === "uploading" && <p className="text-xs text-slate-500">Enviando imagem...</p>}
          {status === "success" && <p className="text-xs text-green-700">Imagem enviada</p>}
          {status === "error" && <p className="text-xs text-red-600">{errorMessage}</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setManualMode((prev) => !prev)}
        className="w-fit text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
      >
        {manualMode ? "Ocultar URL manual" : "Usar URL manual"}
      </button>

      {manualMode && (
        <input
          type="text"
          placeholder="https://..."
          value={value ?? ""}
          onChange={handleManualChange}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-navy focus:outline-none focus:ring-1 focus:ring-brand-navy"
        />
      )}
    </div>
  );
}

import { ExternalLink } from "lucide-react";
import { urlMelhorRastreio } from "@/lib/rastreio";

type RastreioPedidoProps = {
  codigoRastreio: string;
  /** `inline` para listas; `block` para destaque na timeline. */
  variant?: "inline" | "block";
};

export default function RastreioPedido({
  codigoRastreio,
  variant = "inline",
}: RastreioPedidoProps) {
  const codigo = codigoRastreio.trim();
  const href = urlMelhorRastreio(codigo);

  if (variant === "block") {
    return (
      <div className="mt-3 rounded-md border border-slate-200 bg-slate-50/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Código de rastreio
        </p>
        <p className="mt-1 font-mono text-sm font-medium text-brand-navy">{codigo}</p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-orange underline-offset-4 hover:underline"
        >
          Rastrear no Melhor Rastreio
          <ExternalLink aria-hidden className="h-3.5 w-3.5 shrink-0" />
        </a>
      </div>
    );
  }

  return (
    <p className="mt-1.5 text-xs text-slate-600">
      Rastreio:{" "}
      <span className="font-mono font-medium text-brand-navy">{codigo}</span>
      {" · "}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="inline-flex items-center gap-0.5 font-medium text-brand-orange underline-offset-2 hover:underline"
      >
        Melhor Rastreio
        <ExternalLink aria-hidden className="h-3 w-3" />
      </a>
    </p>
  );
}

// A API pública não garante imagemUrl (sem pipeline de upload configurado no
// backend hoje). Quando o produto não tem imagem, mostramos um placeholder
// genérico e honesto — nunca a foto de outro produto.
// Espera um ancestral posicionado (`relative`) com o tamanho já definido.
function PlaceholderMark() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-sensora-bg-soft">
      <svg width="15%" height="15%" viewBox="0 0 64 64" fill="none" className="text-slate-400">
        <circle cx="32" cy="32" r="22" stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
        <circle cx="32" cy="32" r="13" stroke="currentColor" strokeWidth="1.5" opacity="0.35" />
      </svg>
    </div>
  );
}

export function ProductImage({ src, alt, priority }) {
  if (!src) {
    return <PlaceholderMark />;
  }

  // imagemUrl é uma string livre vinda do backend, sem host conhecido —
  // usamos <img> simples em vez de next/image para não depender de
  // images.remotePatterns configurado para um domínio ainda desconhecido.
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="absolute inset-0 h-full w-full object-cover"
      loading={priority ? "eager" : "lazy"}
    />
  );
}

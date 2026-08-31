"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type PlaceholderImageProps = {
  alt: string;
  /** Quando definido, renderiza a imagem final no lugar do placeholder. */
  src?: string;
  label?: string;
  priority?: boolean;
  /** Atributo `sizes` do next/image (obrigatório com `fill` para evitar o
   *  warning de performance) — descreve a largura real renderizada da
   *  imagem em cada breakpoint. Ver o call site para o cálculo específico. */
  sizes?: string;
  className?: string;
  /** Para imagens de host externo não cadastrado em `images.remotePatterns`
   *  (ex.: `imagemUrl` vindo da API pública da Loja, sem host garantido —
   *  ver frontend/components/loja/ProductImage.js) — pula a otimização do
   *  Next em vez de quebrar em runtime. Default: false. */
  unoptimized?: boolean;
};

// Placeholder visual: mesma caixa para os dois motivos de não haver uma
// imagem final na tela — `src` ausente (texto padrão) ou `src` presente mas
// que falhou ao carregar em runtime (Task 20 — URL válida na Task 16 que
// deixou de responder depois: removida, host fora do ar, erro de rede etc.).
function Placeholder({
  alt,
  label,
  text,
  className,
}: {
  alt: string;
  label?: string;
  text: string;
  className: string;
}) {
  return (
    <div
      role="img"
      aria-label={alt}
      className={`absolute inset-0 flex flex-col items-center justify-center gap-2 border border-dashed border-white/25 bg-gradient-to-br from-brand-navy via-brand-navy-light to-[#5b2f1c] px-6 text-center ${className}`}
    >
      <span className="text-[10px] uppercase tracking-[0.3em] text-white/45">{text}</span>
      {label && (
        <span className="text-lg font-light text-white/85 sm:text-xl">
          {label}
        </span>
      )}
    </div>
  );
}

// Ocupa 100% do container relativo do pai (posicionamento absoluto embutido).
// Basta passar `src` quando a arte final estiver disponível — nenhum outro
// componente precisa mudar.
export default function PlaceholderImage({
  alt,
  src,
  label,
  priority = false,
  sizes,
  className = "",
  unoptimized = false,
}: PlaceholderImageProps) {
  const [falhouAoCarregar, setFalhouAoCarregar] = useState(false);

  // Troca de produto/navegação client-side: o `src` muda, mas o state deste
  // componente pode persistir entre renders — sem este reset, uma imagem
  // quebrada do item anterior continuaria marcada como erro mesmo depois de
  // `src` apontar para uma imagem válida.
  useEffect(() => {
    setFalhouAoCarregar(false);
  }, [src]);

  if (src && !falhouAoCarregar) {
    return (
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes={sizes}
        unoptimized={unoptimized}
        className={`object-cover ${className}`}
        onError={() => setFalhouAoCarregar(true)}
      />
    );
  }

  return (
    <Placeholder
      alt={alt}
      label={label}
      text={falhouAoCarregar ? "Imagem indisponível" : "Imagem em breve"}
      className={className}
    />
  );
}

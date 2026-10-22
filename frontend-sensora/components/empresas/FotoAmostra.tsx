import PlaceholderImage from "@/components/ui/PlaceholderImage";

// Foto de AMOSTRA da página "Para empresas" (fotos já usadas no site):
// marca o lugar das fotos definitivas, que ainda vão ser produzidas. Trocar
// o `src` e tirar o selo quando chegarem.
export default function FotoAmostra({
  src,
  alt,
  sizes,
  className = "",
}: {
  src: string;
  alt: string;
  sizes: string;
  className?: string;
}) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      <PlaceholderImage src={src} alt={alt} label={alt} sizes={sizes} />
      <span className="absolute left-3 top-3 bg-white/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-brand-navy">
        Foto de amostra
      </span>
    </div>
  );
}

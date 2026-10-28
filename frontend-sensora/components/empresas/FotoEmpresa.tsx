import PlaceholderImage from "@/components/ui/PlaceholderImage";

// Foto da página "Para empresas": a caixa (tamanho, borda, posição) vem do
// `className`, e a imagem preenche ela inteira.
export default function FotoEmpresa({
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
    </div>
  );
}

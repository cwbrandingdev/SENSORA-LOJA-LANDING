import PlaceholderImage from "@/components/ui/PlaceholderImage";

// Segunda foto do produto, revelada por cima da capa no hover do cartão
// (o pai precisa ter a classe `group`). Só em ponteiro fino: no toque o
// primeiro toque já navega, então a troca não aparece. Sem segunda foto
// cadastrada, não renderiza nada e o cartão fica como está.
export default function HoverSecondImage({
  src,
  label,
  sizes,
  unoptimized = false,
  className = "",
}: {
  src?: string;
  label: string;
  sizes?: string;
  unoptimized?: boolean;
  className?: string;
}) {
  if (!src) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 ease-out motion-reduce:transition-none pointer-fine:group-hover:opacity-100"
    >
      <PlaceholderImage
        src={src}
        alt=""
        label={label}
        sizes={sizes}
        unoptimized={unoptimized}
        className={className}
      />
    </div>
  );
}

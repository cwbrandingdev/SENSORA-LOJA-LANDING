// Etapa 6.5 (Frete) — mesmo padrão minimalista de EnderecoCardSkeleton
// (mesmas proporções do card real, só com blocos cinza).
export default function FreteOptionsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-live="polite">
      {[0, 1].map((indice) => (
        <div
          key={indice}
          aria-hidden
          className="flex animate-pulse items-start justify-between gap-3 rounded-sm border border-slate-200 p-4"
        >
          <div className="w-full space-y-2">
            <div className="h-4 w-2/5 rounded bg-slate-200" />
            <div className="h-3 w-1/3 rounded bg-slate-200" />
          </div>
          <div className="h-4 w-16 shrink-0 rounded bg-slate-200" />
        </div>
      ))}
    </div>
  );
}

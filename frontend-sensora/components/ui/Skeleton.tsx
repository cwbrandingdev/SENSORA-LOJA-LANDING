// Etapa 6.1 (Refinamento — Minha Conta) — placeholder de loading contextual
// (substitui os "Carregando..." em texto puro): reserva exatamente o espaço
// do conteúdo final (sem layout shift quando os dados chegam) e usa um
// shimmer discreto (keyframe `skeleton-shimmer` em app/globals.css) em vez
// de spinner de tela cheia. `motion-reduce:` troca a animação por uma
// opacidade estática — nunca dispara `skeleton-shimmer` para quem pediu
// menos movimento.
export default function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden rounded-md bg-slate-100 motion-reduce:opacity-70 ${className}`}
    >
      <div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/70 to-transparent motion-reduce:hidden"
        style={{ animation: "skeleton-shimmer 1.6s ease-in-out infinite" }}
      />
    </div>
  );
}

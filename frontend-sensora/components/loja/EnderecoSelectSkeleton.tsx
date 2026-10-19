// Placeholder compacto enquanto os endereços carregam no checkout.
export default function EnderecoSelectSkeleton() {
  return (
    <div
      className="flex animate-pulse flex-col gap-3"
      aria-busy="true"
      aria-hidden
    >
      <div className="h-4 w-28 rounded bg-slate-200" />
      <div className="h-11 w-full rounded-lg bg-slate-200" />
      <div className="h-20 w-full rounded-sm bg-slate-100" />
    </div>
  );
}

// Não existe nenhum componente de skeleton no projeto ainda — este é
// deliberadamente mínimo (mesmas proporções do EnderecoCard real, só com
// blocos cinza em vez de texto) para não introduzir um padrão visual novo
// enquanto os endereços carregam.
export default function EnderecoCardSkeleton() {
  return (
    <div
      aria-hidden
      className="flex animate-pulse items-start justify-between gap-3 rounded-sm border border-slate-200 p-4"
    >
      <div className="w-full space-y-2">
        <div className="h-4 w-3/5 rounded bg-slate-200" />
        <div className="h-3 w-2/5 rounded bg-slate-200" />
        <div className="h-3 w-1/4 rounded bg-slate-200" />
      </div>
      <div className="mt-1 h-4 w-4 shrink-0 rounded-full bg-slate-200" />
    </div>
  );
}

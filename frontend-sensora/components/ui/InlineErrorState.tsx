// Extraído do padrão erro+retry já usado em components/admin/
// IntegracaoStatusCard.tsx e MelhorEnvioIntegracaoCard.tsx (bg-red-50 +
// "Tentar novamente" sublinhado) — em vez de duplicar de novo em cada
// página de listagem do Admin, que hoje só mostra um toast e deixa a lista
// vazia em caso de erro (indistinguível de "não há nenhum registro").
type InlineErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export default function InlineErrorState({ message, onRetry }: InlineErrorStateProps) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 font-medium underline underline-offset-2 hover:text-red-800"
      >
        Tentar novamente
      </button>
    </div>
  );
}

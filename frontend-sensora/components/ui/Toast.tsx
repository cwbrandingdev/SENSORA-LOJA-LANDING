// Componente puramente visual — a lógica de mostrar/remover fica no
// ToastContext. Reaproveita a mesma paleta já usada nos blocos de erro do
// Admin (bg-red-50/text-red-700); verde é só o par de sucesso da mesma
// linguagem, nenhuma cor nova introduzida.
export type ToastItem = {
  id: number;
  type: "success" | "error";
  message: string;
};

type ToastViewportProps = {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
};

const TOAST_STYLES: Record<ToastItem["type"], string> = {
  success: "bg-green-50 text-green-700",
  error: "bg-red-50 text-red-700",
};

export default function ToastViewport({ toasts, onDismiss }: ToastViewportProps) {
  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:w-auto">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={`flex items-start justify-between gap-3 rounded-md px-4 py-3 text-sm shadow-sm ${TOAST_STYLES[toast.type]}`}
        >
          <span>{toast.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 text-current/60 hover:text-current"
            aria-label="Fechar notificação"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

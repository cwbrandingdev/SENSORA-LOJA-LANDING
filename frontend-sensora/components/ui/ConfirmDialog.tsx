"use client";

// Etapa 5B.7 — não existia nenhum componente de Dialog/Modal/Confirmation
// reutilizável no projeto (auditoria: só `window.confirm` nativo, usado no
// cancelamento de pedido PENDENTE). Criado aqui como componente genérico
// (não amarrado a reembolso) justamente para futuras confirmações não
// precisarem recriar isso — mesmo sistema visual já existente (FormButton,
// tipografia serif dos títulos, paleta brand-navy/slate), sem introduzir
// nada novo.
import { useEffect } from "react";
import type { ReactNode } from "react";
import FormButton from "./FormButton";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  confirmingLabel?: string;
  cancelLabel?: string;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  confirmingLabel = "Processando...",
  cancelLabel = "Voltar",
  confirming = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  // Esc fecha o modal — nunca enquanto uma confirmação já está em
  // andamento (evita fechar a tela no meio de uma chamada que o usuário já
  // não pode mais cancelar de fato).
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !confirming) {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, confirming, onCancel]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-navy/40 px-4"
      onClick={() => {
        if (!confirming) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-md border border-slate-200 bg-white p-6 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2
          id="confirm-dialog-title"
          className="font-serif text-xl font-normal text-brand-navy"
        >
          {title}
        </h2>
        <div
          id="confirm-dialog-description"
          className="mt-3 text-sm leading-relaxed text-slate-600"
        >
          {description}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <FormButton
            type="button"
            variant="ghost"
            onClick={onCancel}
            disabled={confirming}
          >
            {cancelLabel}
          </FormButton>
          <FormButton
            type="button"
            variant="danger"
            onClick={onConfirm}
            disabled={confirming}
            autoFocus
          >
            {confirming ? confirmingLabel : confirmLabel}
          </FormButton>
        </div>
      </div>
    </div>
  );
}

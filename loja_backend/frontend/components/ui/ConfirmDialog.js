"use client";

import * as AlertDialog from "@radix-ui/react-alert-dialog";
import Button from "@/components/ui/Button";

export default function ConfirmDialog({
  open,
  onOpenChange,
  title = "Tem certeza?",
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  onConfirm,
  loading = false,
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-[state=closed]:opacity-0 data-[state=open]:opacity-100" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white p-5 shadow-xl outline-none transition-all duration-150 data-[state=closed]:scale-95 data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=open]:opacity-100">
          <AlertDialog.Title className="text-base font-semibold text-slate-900">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-2 text-sm text-slate-500">
              {description}
            </AlertDialog.Description>
          )}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" type="button">
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <AlertDialog.Action asChild>
              <Button
                variant="danger"
                type="button"
                disabled={loading}
                onClick={(event) => {
                  // Radix fecha o Alert Dialog automaticamente ao clicar em
                  // Action; para ações assíncronas isso fecharia antes da
                  // operação terminar, escondendo o estado de loading e
                  // qualquer erro. O chamador decide quando fechar (via
                  // onOpenChange), normalmente só após o sucesso.
                  event.preventDefault();
                  onConfirm?.();
                }}
              >
                {loading ? "Aguarde..." : confirmLabel}
              </Button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

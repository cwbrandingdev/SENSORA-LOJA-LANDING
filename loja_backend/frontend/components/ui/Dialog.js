"use client";

import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export default function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = "",
}) {
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/50 transition-opacity duration-150 data-[state=closed]:opacity-0 data-[state=open]:opacity-100" />
        <RadixDialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg bg-white shadow-xl outline-none transition-all duration-150 data-[state=closed]:scale-95 data-[state=closed]:opacity-0 data-[state=open]:scale-100 data-[state=open]:opacity-100",
            className
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <RadixDialog.Title className="text-base font-semibold text-slate-900">
                {title}
              </RadixDialog.Title>
              <RadixDialog.Description
                className={description ? "mt-1 text-sm text-slate-500" : "sr-only"}
              >
                {description ?? title}
              </RadixDialog.Description>
            </div>
            <RadixDialog.Close asChild>
              <button
                type="button"
                aria-label="Fechar"
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/30"
              >
                <X size={18} />
              </button>
            </RadixDialog.Close>
          </div>
          <div className="px-5 py-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

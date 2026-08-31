import type { ReactNode } from "react";
import { Toaster } from "sonner";
import ProtectedLayout from "@/components/layout/ProtectedLayout";

export const metadata = {
  title: "Painel administrativo — Sensora Loja",
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ProtectedLayout>{children}</ProtectedLayout>
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}

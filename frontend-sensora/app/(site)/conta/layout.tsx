import type { Metadata } from "next";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedAccountLayout from "@/components/conta/ProtectedAccountLayout";

export const metadata: Metadata = {
  title: "Minha Conta | Sensora",
};

// AuthProvider aqui é escopado só à árvore de /conta — o layout raiz do site
// (app/(site)/layout.tsx) deliberadamente NÃO envolve {children} com
// AuthProvider (só o Navbar), para não conflitar com o guard próprio de
// páginas como /loja/checkout (ver comentário lá). Mesma solução que
// app/admin/layout.tsx já usa: uma instância própria de AuthProvider,
// isolada, sem tocar no layout do site.
export default function ContaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <ProtectedAccountLayout>{children}</ProtectedAccountLayout>
    </AuthProvider>
  );
}

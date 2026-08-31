import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import ProtectedLayout from "@/components/admin/ProtectedLayout";

// Root layout independente: /admin fica fora do grupo (site), então não
// herda o <html>/<body> de app/(site)/layout.tsx (ver docs do Next sobre
// múltiplos root layouts via route groups). Só carrega Inter — o admin usa
// texto de interface, não títulos editoriais em Fraunces.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Painel administrativo — Sensora",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} antialiased`}>
      <body className="bg-background font-sans text-slate-900">
        <AuthProvider>
          <ToastProvider>
            <ProtectedLayout>{children}</ProtectedLayout>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

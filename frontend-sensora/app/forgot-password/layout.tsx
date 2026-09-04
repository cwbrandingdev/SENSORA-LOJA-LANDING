import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { AuthProvider } from "@/context/AuthContext";

// Root layout independente, mesmo padrão de app/login/layout.tsx,
// app/register/layout.tsx e app/confirmar-email/layout.tsx (ver comentário
// lá sobre múltiplos root layouts no App Router) — página de fluxo de
// autenticação, fora do grupo (site).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Esqueci minha senha — Sensora",
};

export default function ForgotPasswordLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} antialiased`}>
      <body className="bg-background font-sans text-slate-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

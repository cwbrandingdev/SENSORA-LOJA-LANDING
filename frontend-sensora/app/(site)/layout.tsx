import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";
import "../globals.css";
import Navbar from "@/components/layout/Navbar";
import SiteMain from "@/components/layout/SiteMain";
import Footer from "@/components/layout/Footer";
import PageFadeIn from "@/components/ui/PageFadeIn";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { ToastProvider } from "@/context/ToastContext";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Sensora | Marketing Sensorial",
  description:
    "Conheça as velas aromáticas, sprays de ambiente, difusores de aroma e kits da Sensora.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${geistMono.variable} ${fraunces.variable} antialiased`}
    >
      <body className="bg-background text-slate-900">
        <CartProvider>
          <ToastProvider>
            <PageFadeIn>
              {/* Task 22 (Navbar/login) — AuthProvider escopado só ao Navbar
                  (único consumidor de useAuth() aqui), não a {children}: as
                  páginas do site (ex.: /loja/checkout) têm sua própria
                  guarda de sessão independente (possuiSessaoValida, ver
                  lib/auth-redirect.ts) com redirect próprio para
                  /login?redirect=... — se AuthProvider também envolvesse
                  {children}, o efeito de auto-logout dele (sincronizarComToken,
                  ver AuthContext.tsx) rodaria depois do guard da página
                  (efeitos disparam de baixo para cima) e sobrescreveria esse
                  redirect com um /login sem o parâmetro, perdendo o destino
                  de retorno. */}
              <AuthProvider>
                <Navbar />
              </AuthProvider>
              <SiteMain>{children}</SiteMain>
              <Footer />
            </PageFadeIn>
          </ToastProvider>
        </CartProvider>
      </body>
    </html>
  );
}

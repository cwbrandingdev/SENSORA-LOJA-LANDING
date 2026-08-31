import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import { AuthProvider } from "@/context/AuthContext";

// Root layout independente (fora do grupo (site) — ver app/admin/layout.tsx
// para o mesmo raciocínio sobre múltiplos root layouts no App Router).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Login — Sensora",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} antialiased`}>
      <body className="bg-background font-sans text-slate-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

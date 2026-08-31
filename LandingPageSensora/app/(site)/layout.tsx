import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter } from "next/font/google";
import "../globals.css";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import PageFadeIn from "@/components/ui/PageFadeIn";
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
              <Navbar />
              <main className="flex-1">{children}</main>
              <Footer />
            </PageFadeIn>
          </ToastProvider>
        </CartProvider>
      </body>
    </html>
  );
}

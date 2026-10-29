import type { Metadata } from "next";
import { Fraunces, Geist_Mono, Inter, Nunito } from "next/font/google";
import "../globals.css";
import Navbar from "@/components/layout/Navbar";
import FaixaCupom from "@/components/layout/FaixaCupom";
import SacolaDrawer from "@/components/loja/SacolaDrawer";
import SiteMain from "@/components/layout/SiteMain";
import SiteFooter from "@/components/layout/SiteFooter";
import CookieConsentBanner from "@/components/layout/CookieConsentBanner";
import OptionalAnalyticsScripts from "@/components/layout/OptionalAnalyticsScripts";
import PageFadeIn from "@/components/ui/PageFadeIn";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { ToastProvider } from "@/context/ToastContext";
import { COOKIE_CONSENT_KEY } from "@/lib/constants";
import {
  COOKIE_CONSENT_BANNER_OCULTO_ATTR,
  COOKIE_CONSENT_VERSION,
} from "@/lib/cookieConsent";
import JsonLd from "@/components/seo/JsonLd";
import { listarColecoesPublicas } from "@/lib/api-publica";
import { EMPRESA } from "@/lib/empresa";
import { OPEN_GRAPH_PADRAO, SITE_URL, urlAbsoluta } from "@/lib/seo";
import { buscarFaixaCupomPublica } from "@/lib/api-publica";

// Roda antes da primeira pintura: se já existe um consentimento válido
// (mesmas regras de parseStored em lib/cookieConsent.ts), marca o <html>
// para o CSS esconder o aviso que vem no HTML do servidor — sem piscar.
// O aviso vem do servidor para aparecer junto com a página, e não só
// depois de todo o JavaScript (era o LCP do PageSpeed mobile, ~7s).
const scriptConsentimento = `try{var r=localStorage.getItem(${JSON.stringify(COOKIE_CONSENT_KEY)});if(r){var p=JSON.parse(r),c=p&&p.categories;if(p&&p.version===${COOKIE_CONSENT_VERSION}&&p.decidedAt&&c&&c.essential===true&&typeof c.analytics==="boolean"&&typeof c.marketing==="boolean")document.documentElement.setAttribute(${JSON.stringify(COOKIE_CONSENT_BANNER_OCULTO_ATTR)},"")}}catch(e){}`;
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Geist Mono (só nos <code> da Política de Cookies) e Nunito (só no menu)
// sem preload: não disputam banda com o que aparece no topo da página no
// celular. Continuam carregando quando usadas (display: swap).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  preload: false,
});

// Sem canonical aqui de propósito: todas as páginas herdariam o da home.
// Os canonicals ficam só nas páginas que precisam (home, catálogo, produto).
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Sensora Home | Velas aromáticas, sprays e difusores de ambiente",
    template: "%s | Sensora",
  },
  description:
    "Velas aromáticas veganas de cera de coco, sprays de ambiente, difusores de ambiente e kits da Sensora. Fragrâncias para transformar a atmosfera da sua casa.",
  openGraph: OPEN_GRAPH_PADRAO,
};

// Quem é a Sensora, para o Google (painel da marca) e para as IAs.
const organizacaoJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: EMPRESA.nomeFantasia,
  legalName: EMPRESA.razaoSocial,
  taxID: EMPRESA.cnpj,
  url: SITE_URL,
  logo: urlAbsoluta("/logo.png"),
  image: urlAbsoluta("/og-image.jpg"),
  email: EMPRESA.email,
  sameAs: [EMPRESA.instagramUrl],
  address: {
    "@type": "PostalAddress",
    streetAddress: EMPRESA.endereco,
    addressLocality: EMPRESA.cidade,
    addressRegion: EMPRESA.uf,
    postalCode: EMPRESA.cep,
    addressCountry: "BR",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
<<<<<<< HEAD
  // Coleções festivas ligadas no Admin viram itens do menu.
  const colecoes = await listarColecoesPublicas();
=======
  const faixaInicial = await buscarFaixaCupomPublica();
>>>>>>> 86e6ed3a264bc824e8b92b67e6bd72aa771fe15f

  return (
    <html
      lang="pt-BR"
      className={`${inter.variable} ${geistMono.variable} ${fraunces.variable} ${nunito.variable} antialiased`}
      // O script abaixo pode marcar o <html> antes da hidratação.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: scriptConsentimento }} />
      </head>
      <body className="bg-background text-slate-900">
        <JsonLd data={organizacaoJsonLd} />
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
<<<<<<< HEAD
                <Navbar colecoes={colecoes} />
=======
                {faixaInicial ? (
                  <style>{`:root{--faixa-cupom:2.25rem}`}</style>
                ) : null}
                <FaixaCupom inicial={faixaInicial} />
                <Navbar />
>>>>>>> 86e6ed3a264bc824e8b92b67e6bd72aa771fe15f
              </AuthProvider>
              <SiteMain>{children}</SiteMain>
              <SiteFooter />
              <SacolaDrawer />
              <CookieConsentBanner />
              <OptionalAnalyticsScripts />
            </PageFadeIn>
          </ToastProvider>
        </CartProvider>
      </body>
    </html>
  );
}

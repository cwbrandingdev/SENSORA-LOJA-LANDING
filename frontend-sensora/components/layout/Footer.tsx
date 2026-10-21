import type { ReactNode } from "react";
import Link from "next/link";
import CookiePreferencesTrigger from "@/components/layout/CookiePreferencesTrigger";
import Logo from "@/components/ui/Logo";
import {
  FOOTER_CONTENT,
  NAV_CATEGORIES,
  PRODUCT_CATEGORIES,
} from "@/lib/content";
import { EMPRESA, ENDERECO_LINHA, ROTAS_LEGAIS } from "@/lib/empresa";
import { ROUTES } from "@/lib/routes";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-brand-navy text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-20 sm:grid-cols-2 lg:grid-cols-5 lg:px-10">
        <div className="sm:col-span-2 lg:col-span-2">
          <Logo className="items-start text-left" />
          <div className="mt-6 flex gap-4">
            {FOOTER_CONTENT.social.map((social) => (
              <Link
                key={social.label}
                href={social.href}
                aria-label={social.label}
                title={social.label}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full text-white/70 ring-1 ring-white/20 transition-colors duration-300 hover:text-brand-orange hover:ring-brand-orange"
              >
                {/* Ícone do Instagram desenhado aqui: o lucide-react não traz
                    mais ícones de marca. Mesmo traço (1.5) dos demais. */}
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-5 w-5"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="0.75" fill="currentColor" stroke="none" />
                </svg>
              </Link>
            ))}
          </div>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-orange">
            Categorias
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            {PRODUCT_CATEGORIES.map((item) => (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className="group relative inline-block transition-colors duration-300 hover:text-white"
                >
                  {item.label}
                  <span
                    aria-hidden
                    className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-brand-orange transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-brand-orange">
            Institucional
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            <li>
              <FooterLink href={ROTAS_LEGAIS.quemSomos}>Quem somos</FooterLink>
            </li>
            <li>
              <FooterLink href={ROTAS_LEGAIS.termos}>Termos de Uso</FooterLink>
            </li>
            <li>
              <FooterLink href={ROTAS_LEGAIS.privacidade}>
                Política de Privacidade
              </FooterLink>
            </li>
            <li>
              <FooterLink href={ROTAS_LEGAIS.trocas}>
                Trocas e devoluções
              </FooterLink>
            </li>
            <li>
              <FooterLink href={ROTAS_LEGAIS.cookies}>
                Política de Cookies
              </FooterLink>
            </li>
            <li>
              <FooterLink href="/faq">Perguntas frequentes</FooterLink>
            </li>
            <li>
              <FooterLink href={ROUTES.CONTA_SUPORTE}>Suporte</FooterLink>
            </li>
            <li>
              <CookiePreferencesTrigger />
            </li>
            <li>
              <a
                href={`mailto:${FOOTER_CONTENT.contact.email}`}
                className="hover:text-white"
              >
                {FOOTER_CONTENT.contact.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/10">
        {/* Identificação legal (Decreto 7.962/2013) em linha única, como a
            referência: © ano, marca — direitos reservados razão social,
            endereço completo, CNPJ e e-mail. Os documentos da loja ficam
            na coluna Institucional acima. */}
        <div className="mx-auto max-w-7xl px-6 py-6 text-center text-xs leading-relaxed text-white/60 lg:px-10">
          <address className="not-italic">
            <span className="uppercase">
              © {year}, {EMPRESA.nomeFantasia} - Todos os direitos reservados{" "}
              {EMPRESA.razaoSocial}
            </span>
            , {ENDERECO_LINHA}, CNPJ {EMPRESA.cnpj}. E-mail:{" "}
            <a
              href={`mailto:${EMPRESA.email}`}
              className="underline underline-offset-2 hover:text-white"
            >
              {EMPRESA.email}
            </a>
          </address>
          <p className="mt-2">
            As promoções expostas neste site são válidas por tempo determinado
            ou enquanto durarem os estoques.
          </p>
        </div>
        <div className="mx-auto flex max-w-7xl justify-center px-6 pb-6 lg:px-10">
          {/* Crédito da agência: um reflexo laranja passa pelo nome no hover. */}
          <a
            href="https://cwbranding.com.br/"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-baseline gap-2"
          >
            <span className="text-[10px] uppercase tracking-[0.25em] text-white/40">
              feito por
            </span>
            <span className="bg-[linear-gradient(110deg,rgba(255,255,255,0.7)_40%,#d97f5c_50%,rgba(255,255,255,0.7)_60%)] bg-[length:250%_100%] bg-clip-text bg-[position:100%_0] font-serif text-xl italic text-transparent transition-[background-position] duration-1000 ease-out group-hover:bg-[position:0%_0]">
              CWBranding
            </span>
          </a>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="group relative inline-block transition-colors duration-300 hover:text-white"
    >
      {children}
      <span
        aria-hidden
        className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-brand-orange transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
      />
    </Link>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";
import CookiePreferencesTrigger from "@/components/layout/CookiePreferencesTrigger";
import IdentificacaoFornecedor from "@/components/legal/IdentificacaoFornecedor";
import Logo from "@/components/ui/Logo";
import {
  FOOTER_CONTENT,
  NAV_CATEGORIES,
  PRODUCT_CATEGORIES,
} from "@/lib/content";
import { ROTAS_LEGAIS } from "@/lib/empresa";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-brand-navy text-white">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 py-20 sm:grid-cols-2 lg:grid-cols-5 lg:px-10">
        <div className="sm:col-span-2 lg:col-span-2">
          <Logo className="items-start text-left" />
          <p className="mt-4 max-w-xs text-sm text-white/70">
            {FOOTER_CONTENT.tagline}
          </p>
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-orange">
            Navegação
          </h3>
          <ul className="mt-4 space-y-2 text-sm text-white/80">
            {NAV_CATEGORIES.map((item) => (
              <li key={item.label}>
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
          <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-orange">
            Categorias
          </h3>
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
          <h3 className="text-xs font-semibold uppercase tracking-widest text-brand-orange">
            Institucional
          </h3>
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
          <div className="mt-6 flex gap-4">
            {FOOTER_CONTENT.social.map((social) => (
              <Link
                key={social.label}
                href={social.href}
                aria-label={social.label}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative inline-block text-sm text-white/70 transition-colors duration-300 hover:text-brand-orange"
              >
                {social.label}
                <span
                  aria-hidden
                  className="absolute inset-x-0 -bottom-0.5 h-px origin-left scale-x-0 bg-brand-orange transition-transform duration-300 ease-out group-hover:scale-x-100 motion-reduce:transition-none"
                />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 text-center text-xs text-white/60 sm:text-left lg:px-10">
          <IdentificacaoFornecedor className="space-y-1 text-white/70" />
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p>© {year} Sensora. Todos os direitos reservados.</p>
            <p className="uppercase tracking-[0.2em]">Marketing Sensorial</p>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-6 pb-6 text-center text-[11px] text-white/40 lg:px-10">
          <p>Loja feita por agencia CWBranding</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
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

"use client";

// Etapa 1 (Fundação) da área "Minha Conta" — só a página inicial, com
// saudação e cards de navegação para as próximas etapas (ainda não
// implementadas). Nenhuma chamada de API nesta página: todo dado exibido já
// está disponível no token local (via AuthContext/decodeToken), o mesmo
// limite já documentado em app/(site)/loja/checkout/page.tsx — o JWT (Task
// 3/17 do backend) só carrega sub/email/perfil, sem `nome` e sem nenhum
// endpoint self-service ainda exposto para buscar o nome completo. Por isso
// a saudação deriva um nome provisório da parte local do e-mail, mesmo
// fallback já usado ali.
import { useMemo } from "react";
import Link from "next/link";
import { Package, User, MapPin, ShieldCheck, ArrowRight } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { decodeToken } from "@/lib/jwt";
import { getToken } from "@/lib/storage";
import { ROUTES } from "@/lib/routes";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import Button from "@/components/ui/Button";
import AccountPageHeader from "@/components/conta/AccountPageHeader";

type ContaCard = {
  titulo: string;
  descricao: string;
  icon: typeof Package;
  // Presente = card funcional (vira link). Ausente = placeholder "Em breve"
  // (ainda não implementado). "Meus pedidos" (Etapa 2), "Dados pessoais"/
  // "Segurança" (Etapa 3) e "Endereços" (Etapa 4) já têm href — todos os
  // cards desta página estão funcionais.
  href?: string;
};

const CARDS: ContaCard[] = [
  {
    titulo: "Meus pedidos",
    descricao: "Acompanhe o histórico e o status dos seus pedidos.",
    icon: Package,
    href: ROUTES.CONTA_PEDIDOS,
  },
  {
    titulo: "Dados pessoais",
    descricao: "Atualize seu nome e e-mail de cadastro.",
    icon: User,
    href: ROUTES.CONTA_DADOS_PESSOAIS,
  },
  {
    titulo: "Endereços",
    descricao: "Gerencie os endereços de entrega salvos na sua conta.",
    icon: MapPin,
    href: ROUTES.CONTA_ENDERECOS,
  },
  {
    titulo: "Segurança",
    descricao: "Altere sua senha da sua conta.",
    icon: ShieldCheck,
    href: ROUTES.CONTA_SEGURANCA,
  },
];

export default function ContaPage() {
  const { logout } = useAuth();

  // Deriva um nome de exibição provisório a partir do e-mail do token —
  // "quando disponível": se o token não puder ser lido por qualquer motivo,
  // a saudação cai para o texto genérico, sem quebrar a página.
  const nomeExibicao = useMemo(() => {
    const email = decodeToken(getToken())?.email;
    return email ? email.split("@")[0] : null;
  }, []);

  return (
    <div className="mx-auto max-w-4xl px-6 pt-28 pb-24 sm:pt-36 sm:pb-32 lg:px-10">
      <AccountPageHeader
        title={nomeExibicao ? `Olá, ${nomeExibicao}` : "Olá"}
        description="Aqui você vai poder acompanhar seus pedidos, gerenciar seus dados pessoais e endereços, e cuidar da segurança da sua conta. Estamos construindo essa área aos poucos — em breve, mais novidades por aqui."
      />

      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {CARDS.map((card, index) => {
          const Icon = card.icon;
          return (
            <RevealOnScroll key={card.titulo} delayMs={90 + index * 60}>
              {card.href ? (
                <Link
                  href={card.href}
                  className="group flex h-full flex-col gap-3 rounded-sm border border-slate-200 bg-white p-6 transition-[transform,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-1 hover:border-brand-navy/30 hover:shadow-lg hover:shadow-brand-navy/5 motion-reduce:hover:translate-y-0"
                >
                  <div className="flex items-center justify-between">
                    <span
                      aria-hidden
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-navy/5 text-brand-navy transition-colors duration-300 group-hover:bg-brand-orange/10 group-hover:text-brand-orange"
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <ArrowRight
                      aria-hidden
                      className="h-4 w-4 text-brand-orange opacity-0 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:translate-x-0.5 group-hover:opacity-100"
                    />
                  </div>
                  <h2 className="font-serif text-lg font-normal text-brand-navy">
                    {card.titulo}
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {card.descricao}
                  </p>
                </Link>
              ) : (
                <div
                  aria-disabled="true"
                  className="flex h-full flex-col gap-3 rounded-sm border border-slate-200 p-6 opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <span
                      aria-hidden
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400"
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Em breve
                    </span>
                  </div>
                  <h2 className="font-serif text-lg font-normal text-brand-navy">
                    {card.titulo}
                  </h2>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {card.descricao}
                  </p>
                </div>
              )}
            </RevealOnScroll>
          );
        })}
      </div>

      <RevealOnScroll delayMs={330}>
        <div className="mt-12 border-t border-slate-200 pt-8">
          <Button onClick={logout} variant="navy">
            Sair da conta
          </Button>
        </div>
      </RevealOnScroll>
    </div>
  );
}

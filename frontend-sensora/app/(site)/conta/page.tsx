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
import { useAuth } from "@/context/AuthContext";
import { decodeToken } from "@/lib/jwt";
import { getToken } from "@/lib/storage";
import { ROUTES } from "@/lib/routes";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import Button from "@/components/ui/Button";

type ContaCard = {
  titulo: string;
  descricao: string;
  // Presente = card funcional (vira link). Ausente = placeholder "Em breve"
  // (ainda não implementado). "Meus pedidos" (Etapa 2), "Dados pessoais" e
  // "Segurança" (Etapa 3) já têm href; "Endereços" segue como placeholder
  // até sua etapa.
  href?: string;
};

const CARDS: ContaCard[] = [
  {
    titulo: "Meus pedidos",
    descricao: "Acompanhe o histórico e o status dos seus pedidos.",
    href: ROUTES.CONTA_PEDIDOS,
  },
  {
    titulo: "Dados pessoais",
    descricao: "Atualize seu nome e e-mail de cadastro.",
    href: ROUTES.CONTA_DADOS_PESSOAIS,
  },
  {
    titulo: "Endereços",
    descricao: "Gerencie os endereços de entrega salvos na sua conta.",
  },
  {
    titulo: "Segurança",
    descricao: "Altere sua senha da sua conta.",
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
      <RevealOnScroll>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
          Minha Conta
        </p>
        <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
          {nomeExibicao ? `Olá, ${nomeExibicao}` : "Olá"}
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
          Aqui você vai poder acompanhar seus pedidos, gerenciar seus dados
          pessoais e endereços, e cuidar da segurança da sua conta. Estamos
          construindo essa área aos poucos — em breve, mais novidades por
          aqui.
        </p>
      </RevealOnScroll>

      <RevealOnScroll delayMs={90}>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CARDS.map((card) =>
            card.href ? (
              <Link
                key={card.titulo}
                href={card.href}
                className="flex flex-col gap-2 rounded-sm border border-slate-200 p-6 transition-colors hover:border-brand-navy/30 hover:bg-slate-50"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-lg font-normal text-brand-navy">
                    {card.titulo}
                  </h2>
                  <span aria-hidden className="text-brand-orange">
                    →
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">
                  {card.descricao}
                </p>
              </Link>
            ) : (
              <div
                key={card.titulo}
                aria-disabled="true"
                className="flex flex-col gap-2 rounded-sm border border-slate-200 p-6 opacity-60"
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-serif text-lg font-normal text-brand-navy">
                    {card.titulo}
                  </h2>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Em breve
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-slate-600">
                  {card.descricao}
                </p>
              </div>
            ),
          )}
        </div>
      </RevealOnScroll>

      <RevealOnScroll delayMs={180}>
        <div className="mt-12 border-t border-slate-200 pt-8">
          <Button onClick={logout} variant="navy">
            Sair da conta
          </Button>
        </div>
      </RevealOnScroll>
    </div>
  );
}

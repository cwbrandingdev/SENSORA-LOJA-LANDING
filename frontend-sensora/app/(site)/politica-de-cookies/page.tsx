// Rota pública /politica-de-cookies — mesma Navbar/Footer padrão da Landing
// (herdados de app/(site)/layout.tsx, sem layout novo), mesmo padrão visual
// de cabeçalho de ColecoesPage.tsx/FaqSection.tsx.
//
// O conteúdo abaixo descreve só o que REALMENTE existe no código hoje (ver
// vistoria que precedeu esta implementação): nenhuma política/prazo/cookie
// inventado. Os nomes técnicos (sensora_token etc.) vêm de lib/constants.ts
// — nunca hardcoded soltos aqui — para que este texto nunca se desalinhe
// silenciosamente do nome real usado pelo código.
import type { Metadata } from "next";
import Link from "next/link";
import RevealOnScroll from "@/components/ui/RevealOnScroll";
import {
  CART_STORAGE_KEY,
  CHECKOUT_PENDENTE_KEY,
  COOKIE_CONSENT_KEY,
  TOKEN_KEY,
} from "@/lib/constants";

export const metadata: Metadata = {
  title: "Política de Cookies",
  description:
    "Como a Sensora usa cookies e armazenamento local essenciais para autenticação, carrinho e continuidade do checkout.",
};

function Secao({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 pt-8">
      <h2 className="font-serif text-xl font-normal text-brand-navy sm:text-2xl">
        {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-600">
        {children}
      </div>
    </section>
  );
}

function ChaveItem({
  chave,
  tipo,
  finalidade,
}: {
  chave: string;
  tipo: string;
  finalidade: string;
}) {
  return (
    <div className="rounded-sm border border-slate-200 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px] text-brand-navy">
          {chave}
        </code>
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-orange">
          {tipo}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{finalidade}</p>
    </div>
  );
}

export default function PoliticaDeCookiesPage() {
  return (
    <div className="pb-24 sm:pb-32 lg:pb-40">
      <section className="relative mx-auto max-w-3xl overflow-hidden px-6 pt-8 pb-8 text-center lg:px-10">
        <RevealOnScroll>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            Sensora
          </p>
          <h1 className="mt-4 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
            Política de Cookies
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-600">
            Esta página explica, de forma direta, quais cookies e
            mecanismos de armazenamento local a Sensora usa hoje neste site
            — e por quê.
          </p>
        </RevealOnScroll>
      </section>

      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 lg:px-10">
        <Secao title="Resumo">
          <p>
            Hoje a Sensora usa tecnologias <strong>essenciais</strong> para
            login, carrinho e checkout. Cookies de <strong>medição e
            marketing</strong> são opcionais e dependem do seu consentimento,
            gerenciado pelo aviso na primeira visita e pelo link{" "}
            <strong>Preferências de cookies</strong> no rodapé. O tratamento
            dos demais dados pessoais está na{" "}
            <Link href="/politica-de-privacidade" className="text-brand-navy underline underline-offset-4">
              Política de Privacidade
            </Link>
            .
          </p>
        </Secao>

        <Secao title="Cookie essencial">
          <ChaveItem
            chave={TOKEN_KEY}
            tipo="Cookie · Essencial"
            finalidade="Guarda uma cópia do seu token de sessão (o mesmo já salvo no armazenamento local do navegador), usada apenas para que o site saiba, antes mesmo da página carregar, que você já está logado — por exemplo, para não te mostrar a tela de login se você já tem uma sessão válida. Expira automaticamente junto com a sua sessão."
          />
        </Secao>

        <Secao title="Armazenamento local (localStorage)">
          <p>
            Além do cookie acima, o navegador guarda localmente (nunca
            enviado a nenhum servidor de terceiro) os seguintes dados:
          </p>
          <div className="flex flex-col gap-3">
            <ChaveItem
              chave={TOKEN_KEY}
              tipo="localStorage · Autenticação"
              finalidade="Seu token de sessão, usado para manter você logado entre visitas e autorizar suas ações na loja e em Minha Conta."
            />
            <ChaveItem
              chave={`${CART_STORAGE_KEY} / ${CART_STORAGE_KEY}_<id>`}
              tipo="localStorage · Carrinho"
              finalidade="Os itens do seu carrinho de compras, para que eles continuem lá se você fechar o site e voltar depois. Guardado por conta (quando você está logado) ou como visitante."
            />
            <ChaveItem
              chave={CHECKOUT_PENDENTE_KEY}
              tipo="localStorage · Continuidade do checkout"
              finalidade="Identifica, ao voltar do ambiente de pagamento, qual pedido você estava finalizando — necessário para confirmar o status certo e limpar o carrinho só depois da confirmação real do pagamento."
            />
            <ChaveItem
              chave={COOKIE_CONSENT_KEY}
              tipo="localStorage · Preferência de consentimento"
              finalidade="Registra sua escolha sobre cookies opcionais (analytics/marketing), a data da decisão e evita reexibir o aviso a cada visita. Base legal: consentimento (LGPD, art. 7º, I) para opcionais; execução do contrato/interesse legítimo para essenciais."
            />
          </div>
        </Secao>

        <Secao title="Base legal (LGPD)">
          <p>
            Cookies <strong>essenciais</strong> são necessários para o
            funcionamento da loja (login, carrinho, pagamento) e seguem as
            bases legais de execução de contrato e legítimo interesse, sem
            exigir consentimento — mas você sempre será informado aqui e no
            aviso do site.
          </p>
          <p>
            Cookies <strong>opcionais</strong> (analytics e marketing) só são
            ativados depois de um consentimento livre, informado e
            inequívoco. Você pode recusá-los sem perder acesso à loja, alterar
            a escolha pelo link <strong>Preferências de cookies</strong> no
            rodapé ou revogar o consentimento a qualquer momento pelas
            configurações do navegador.
          </p>
        </Secao>

        <Secao title="Cookies de analytics e marketing">
          <p>
            <strong>Analytics:</strong> se configurarmos uma ferramenta como
            Google Analytics (variável{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[12px]">
              NEXT_PUBLIC_GA_MEASUREMENT_ID
            </code>
            ), ela só é carregada após você aceitar a categoria Analytics no
            aviso de cookies. Mede visitas e desempenho de forma agregada;
            pedimos anonimização de IP quando suportado pelo provedor.
          </p>
          <p>
            <strong>Marketing:</strong> hoje não utilizamos pixels de
            remarketing neste site. A categoria existe no painel de
            preferências para que, se passarmos a usar essas ferramentas, você
            já possa consentir ou recusar de forma granular — sempre antes de
            qualquer script opcional ser executado.
          </p>
        </Secao>

        <Secao title="Serviços externos">
          <p>
            Para processar pagamentos e calcular fretes, a Sensora trabalha
            com parceiros externos — Asaas (pagamentos) e Melhor Envio
            (cálculo e etiquetas de frete). Ao ser redirecionado para o
            ambiente de pagamento do Asaas, por exemplo, você passa a estar
            no domínio deles, sujeito às tecnologias e à política de
            cookies próprias dessas plataformas — a Sensora não controla
            nem tem acesso aos cookies que eles eventualmente definirem em
            seus próprios domínios.
          </p>
        </Secao>

        <Secao title="Como gerenciar">
          <p>
            Use <strong>Preferências de cookies</strong> no rodapé para abrir o
            painel e aceitar, recusar ou alterar categorias opcionais. Você
            também pode apagar cookies e dados de sites pelas configurações do
            navegador — isso encerra sua sessão e/ou esvazia o carrinho quando
            envolve dados essenciais.
          </p>
        </Secao>
      </div>
    </div>
  );
}

import RevealOnScroll from "@/components/ui/RevealOnScroll";
import TextReveal from "@/components/ui/TextReveal";
import FaqAccordion from "@/components/ui/FaqAccordion";
import { FAQ_CONTENT, FAQ_ITEMS } from "@/lib/content";

// JSON-LD FAQPage — gerado a partir do MESMO FAQ_ITEMS renderizado abaixo
// (nunca uma lista paralela/hardcoded), garantindo que o conteúdo
// estruturado e o visível nunca fiquem dessincronizados.
function buildFaqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

// Usado como página dedicada (/faq, ver app/(site)/faq/page.tsx) — o
// padding vertical segue o mesmo padrão das demais páginas internas
// (ColecoesPage etc.): pouco espaço no topo (SiteMain já reserva
// `pt-[var(--navbar-height)]` para todas as rotas exceto a home) e respiro
// generoso no fim. `id="faq-heading"` some da árvore de heading da Home
// (não é mais uma seção entre outras), por isso é <h1> — título principal
// da página, não mais um <h2> subordinado a um <h1> do carrossel.
export default function FaqSection() {
  return (
    <section aria-labelledby="faq-heading" className="relative bg-background pt-8 pb-24 sm:pb-32 lg:pb-40">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(buildFaqJsonLd()) }}
      />

      <div className="mx-auto max-w-4xl px-6 lg:px-10">
        <RevealOnScroll className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            {FAQ_CONTENT.eyebrow}
          </p>
          <h1
            id="faq-heading"
            className="mt-4 font-serif text-4xl leading-[1.05] font-normal tracking-tight text-brand-navy sm:text-5xl"
          >
            <TextReveal>{FAQ_CONTENT.title}</TextReveal>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-base leading-relaxed text-slate-600">
            {FAQ_CONTENT.intro}
          </p>
        </RevealOnScroll>

        <RevealOnScroll delayMs={120} className="mt-14">
          <FaqAccordion items={FAQ_ITEMS} defaultOpenIds={[FAQ_ITEMS[0]?.id ?? ""]} />
        </RevealOnScroll>
      </div>
    </section>
  );
}

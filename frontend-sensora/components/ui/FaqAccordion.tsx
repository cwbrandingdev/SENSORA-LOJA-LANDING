"use client";

// Accordion de FAQ, genérico e reutilizável (recebe os itens via prop —
// nenhum dado da Sensora fica acoplado aqui, ver FAQ_ITEMS em lib/content.ts
// e o uso em components/sections/FaqSection.tsx).
//
// Sem dependência nova: a expansão usa a técnica de CSS puro
// `grid-template-rows: 0fr -> 1fr` (grid com uma única linha, cuja altura
// pode ser animada via `transition-[grid-template-rows]`, diferente de
// `height: auto`, que não é animável). Mesmo raciocínio de "sem lib de
// animação" já usado em RevealOnScroll.tsx/TextReveal.tsx — e, como lá,
// todo `transition` aqui tem seu par `motion-reduce:transition-none`
// (mesmo idioma de Footer.tsx), então quem pede menos movimento no
// aparelho vê o conteúdo abrir/fechar sem nenhuma transição.
//
// Suporta múltiplos itens abertos ao mesmo tempo (`Set<string>` de ids
// abertos) — cada botão alterna só o seu próprio id, sem fechar os outros.
import { useId, useState } from "react";
import { Plus } from "lucide-react";

export type FaqAccordionItem = {
  id: string;
  question: string;
  answer: string;
};

type FaqAccordionProps = {
  items: FaqAccordionItem[];
  /** IDs abertos por padrão (ex.: primeira pergunta já expandida). */
  defaultOpenIds?: string[];
  className?: string;
};

export default function FaqAccordion({
  items,
  defaultOpenIds = [],
  className = "",
}: FaqAccordionProps) {
  const [openIds, setOpenIds] = useState<Set<string>>(
    () => new Set(defaultOpenIds),
  );
  const baseId = useId();

  function toggle(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className={`divide-y divide-brand-navy/10 ${className}`}>
      {items.map((item) => {
        const isOpen = openIds.has(item.id);
        const buttonId = `${baseId}-${item.id}-button`;
        const panelId = `${baseId}-${item.id}-panel`;

        return (
          <div key={item.id}>
            <h3 className="text-lg">
              <button
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                className="group flex w-full items-center justify-between gap-6 py-6 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-navy/40 focus-visible:ring-offset-4 focus-visible:ring-offset-background"
              >
                <span className="font-serif text-lg leading-snug text-brand-navy transition-colors duration-300 group-hover:text-brand-orange sm:text-xl">
                  {item.question}
                </span>
                <Plus
                  aria-hidden
                  className={`h-5 w-5 shrink-0 text-brand-orange transition-transform duration-300 motion-reduce:transition-none ${
                    isOpen ? "rotate-45" : "rotate-0"
                  }`}
                />
              </button>
            </h3>

            {/* aria-hidden (não o atributo `hidden`) — precisa continuar em
                fluxo normal (display != none) para a transição de altura
                funcionar, mas sai da árvore de acessibilidade enquanto
                fechado, evitando que leitor de tela anuncie um conteúdo
                visualmente colapsado a 0px. */}
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              aria-hidden={!isOpen}
              style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              className="grid transition-[grid-template-rows] duration-[400ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none"
            >
              <div className="overflow-hidden">
                <p className="max-w-2xl pb-6 pr-10 text-base leading-relaxed text-slate-600">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

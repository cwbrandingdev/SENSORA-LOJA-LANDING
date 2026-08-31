"use client";

import { useEffect, useRef, useState } from "react";

type TextRevealProps = {
  /** Texto puro — é dividido em palavras para detectar as quebras de linha reais. */
  children: string;
  delayMs?: number;
  className?: string;
};

const LINE_STAGGER_MS = 90;
const RESIZE_DEBOUNCE_MS = 150;

// Reveal editorial linha a linha: cada linha nasce de trás de uma máscara
// (overflow-hidden) com um stagger curto entre elas, em vez do fade simples
// do RevealOnScroll. As quebras de linha são medidas de verdade (via
// getBoundingClientRect nas palavras), não "chutadas" — por isso reagem
// corretamente a qualquer largura de tela, sem duplicar texto para leitor
// de tela (a cópia usada só para medir é aria-hidden e nunca é o texto lido).
export default function TextReveal({ children, delayMs = 0, className = "" }: TextRevealProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const [lines, setLines] = useState<string[] | null>(null);
  const [visible, setVisible] = useState(false);
  const words = children.trim().split(/\s+/);

  // Mede em quais palavras a linha quebra (uma vez ao montar, e de novo se a
  // tela for redimensionada — o texto pode reagrupar em outra largura).
  useEffect(() => {
    function measure() {
      const groups: string[][] = [];
      let lastTop: number | null = null;

      words.forEach((word, i) => {
        const top = wordRefs.current[i]?.getBoundingClientRect().top;
        if (top === undefined) return;
        if (lastTop === null || Math.abs(top - lastTop) > 2) {
          groups.push([word]);
          lastTop = top;
        } else {
          groups[groups.length - 1].push(word);
        }
      });

      if (groups.length > 0) {
        setLines(groups.map((group) => group.join(" ")));
      }
    }

    measure();

    let resizeTimeout: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(measure, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      clearTimeout(resizeTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={containerRef} className={`relative block ${className}`}>
      {/* Cópia invisível só para medir onde o texto quebra de linha nesta
          largura — nunca é vista nem lida por leitor de tela. */}
      <span aria-hidden className="invisible absolute inset-0">
        {words.map((word, i) => (
          <span
            key={i}
            ref={(el) => {
              wordRefs.current[i] = el;
            }}
          >
            {word}{" "}
          </span>
        ))}
      </span>

      {/* Texto real e acessível, revelado linha a linha assim que medido
          (antes disso, cai como bloco único — sem flash, sem duplicar texto). */}
      {(lines ?? [children]).map((line, i) => (
        <span key={i} className="block overflow-hidden">
          <span
            style={{ transitionDelay: visible ? `${delayMs + i * LINE_STAGGER_MS}ms` : "0ms" }}
            className={`block transition-all duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:opacity-100 ${
              visible ? "translate-y-0 opacity-100" : "translate-y-[16px] opacity-0"
            }`}
          >
            {line}
          </span>
        </span>
      ))}
    </span>
  );
}

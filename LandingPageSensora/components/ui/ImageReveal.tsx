"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type ImageRevealProps = {
  children: ReactNode;
  className?: string;
};

// Reveal de fotografia ao entrar no viewport: opacidade e um zoom quase
// imperceptível (1.03 → 1) assentando no lugar — a moldura já existente
// (overflow-hidden do container pai) funciona como a "máscara" que recorta
// esse leve excesso durante a transição. Mesmo padrão de IntersectionObserver
// do RevealOnScroll/TextReveal; não duplica lógica, só troca o tipo de
// movimento (fade+scale em vez de fade+translate) para se adequar a fotos.
export default function ImageReveal({ children, className = "" }: ImageRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`relative h-full w-full transition-all duration-[1000ms] ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none motion-reduce:opacity-100 motion-reduce:scale-100 ${
        visible ? "scale-100 opacity-100" : "scale-[1.03] opacity-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}

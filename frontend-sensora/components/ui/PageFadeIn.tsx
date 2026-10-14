"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const TRANSITION_MS = 200;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Fade único para a troca entre rotas da landing (ex.: clicar na logo em
// /velas para voltar à home). Como o RootLayout não remonta entre
// navegações client-side, é este componente — e só ele — que decide quando
// o fade acontece; não duplicar essa lógica em outro lugar.
//
// O primeiro load NÃO faz fade: a página já vem visível no HTML do
// servidor. Começar em opacity-0 deixava a tela em branco até o JavaScript
// rodar e fazia o Chrome descartar a foto do topo como LCP (pintada
// invisível) — no PageSpeed mobile o LCP ia para ~7s.
export default function PageFadeIn({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [renderedPathname, setRenderedPathname] = useState(pathname);
  const [displayChildren, setDisplayChildren] = useState(children);
  const [visible, setVisible] = useState(true);

  // Ajuste de estado durante o render (padrão recomendado pelo React para
  // sincronizar estado quando uma prop muda, sem passar por um efeito):
  // ao detectar troca de rota, inicia o fade-out. Com prefers-reduced-motion,
  // troca na hora, sem atraso artificial de navegação.
  if (pathname !== renderedPathname) {
    setRenderedPathname(pathname);
    if (prefersReducedMotion()) {
      setDisplayChildren(children);
    } else {
      setVisible(false);
    }
  } else if (visible && displayChildren !== children) {
    setDisplayChildren(children);
  }

  // Único responsável por "revelar": dispara depois de cada fade-out
  // disparado por uma troca de rota.
  useEffect(() => {
    if (visible) return undefined;
    const timeout = setTimeout(() => {
      setDisplayChildren(children);
      setVisible(true);
    }, TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [visible, children]);

  return (
    <div
      className={`flex min-h-screen flex-col transition-opacity duration-200 ease-out motion-reduce:transition-none ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {displayChildren}
    </div>
  );
}

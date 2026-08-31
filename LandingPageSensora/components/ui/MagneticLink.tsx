"use client";

import Link from "next/link";
import { useRef } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";

type MagneticLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
};

const MAX_PULL_PX = 8;

// Puxão magnético bem contido (máx. 8px): o link segue o cursor de leve, só
// com mouse de verdade (pointerType "mouse", nunca touch/caneta) e nunca com
// prefers-reduced-motion. O projeto não usa framer-motion/motion em nenhum
// outro lugar — esta microinteração é feita só com pointer events + CSS
// transition, no mesmo espírito "sem dependência nova" do RevealOnScroll/
// TextReveal/ImageReveal.
export default function MagneticLink({ href, className = "", children }: MagneticLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);

  function handlePointerMove(event: ReactPointerEvent<HTMLAnchorElement>) {
    if (event.pointerType !== "mouse") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pullX = ((event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2)) * MAX_PULL_PX;
    const pullY = ((event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2)) * MAX_PULL_PX;
    el.style.transform = `translate(${pullX.toFixed(1)}px, ${pullY.toFixed(1)}px)`;
  }

  function resetPull() {
    const el = ref.current;
    if (el) el.style.transform = "";
  }

  return (
    <Link
      ref={ref}
      href={href}
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPull}
      onPointerUp={resetPull}
      className={`inline-block ${className}`}
    >
      {children}
    </Link>
  );
}

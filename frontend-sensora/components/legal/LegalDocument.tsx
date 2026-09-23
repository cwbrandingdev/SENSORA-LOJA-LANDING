import type { ReactNode } from "react";
import RevealOnScroll from "@/components/ui/RevealOnScroll";

export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="pb-24 sm:pb-32 lg:pb-40">
      <section className="relative mx-auto max-w-3xl overflow-hidden px-6 pt-8 pb-8 text-center lg:px-10">
        <RevealOnScroll>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
            Sensora
          </p>
          <h1 className="mt-16 font-serif text-4xl font-normal tracking-tight text-brand-navy sm:text-5xl">
            {title}
          </h1>
          <p className="mt-6 text-base leading-relaxed text-slate-600">
            {intro}
          </p>
        </RevealOnScroll>
      </section>
      <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 lg:px-10">
        {children}
      </div>
    </div>
  );
}

export function Secao({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
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

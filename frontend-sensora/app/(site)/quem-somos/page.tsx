import type { Metadata } from "next";
import PlaceholderImage from "@/components/ui/PlaceholderImage";
import { ABOUT_CONTENT } from "@/lib/content";

export const metadata: Metadata = {
  title: "Quem somos",
  description:
    "Na Sensora Home, acreditamos que os aromas têm o poder de transformar a atmosfera de um ambiente. Conheça a Sensora.",
};

const CITACAO =
  "Uma casa bem perfumada não é apenas percebida — ela é sentida.";

export default function QuemSomosPage() {
  return (
    <div className="relative overflow-hidden">
      {/* Manchas de cor desfocadas ao fundo. */}
      <div
        aria-hidden
        className="absolute top-40 -right-20 h-96 w-96 rounded-full bg-brand-orange/15 blur-3xl"
      />
      <div
        aria-hidden
        className="absolute top-[60%] left-1/4 h-80 w-80 rounded-full bg-[#dbe4f0]/60 blur-3xl"
      />

      <div className="relative mx-auto max-w-6xl px-6 pt-6 pb-24 lg:px-10 lg:pb-32">
        <p
          aria-hidden
          className="select-none text-center font-serif text-[22vw] leading-none text-brand-navy/5 lg:text-[13rem]"
        >
          Sensora
        </p>

        <div className="-mt-10 flex flex-col gap-12 lg:-mt-20 lg:flex-row lg:items-center lg:gap-20">
          <div className="relative mx-auto aspect-square w-full max-w-sm shrink-0 overflow-hidden rounded-[60%_40%_30%_70%/60%_30%_70%_40%] lg:mx-0 lg:w-5/12">
            <PlaceholderImage
              src={ABOUT_CONTENT.imageSrc}
              alt={ABOUT_CONTENT.imageAlt}
              label={ABOUT_CONTENT.title}
              priority
              sizes="(max-width: 1024px) 100vw, 450px"
            />
          </div>

          <div className="max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-orange">
              {ABOUT_CONTENT.eyebrow}
            </p>
            <h1 className="mt-3 font-serif text-5xl text-brand-navy sm:text-6xl">
              Quem somos
            </h1>
            <p className="mt-6 leading-relaxed text-slate-600 first-letter:float-left first-letter:mr-3 first-letter:font-serif first-letter:text-6xl first-letter:leading-none first-letter:text-brand-orange">
              {ABOUT_CONTENT.paragraphs[0]}
            </p>
          </div>
        </div>

        <blockquote className="mx-auto mt-20 max-w-3xl rounded-[2.5rem] bg-[#fbe9dd] px-8 py-10 text-center font-serif text-2xl italic leading-snug text-brand-navy sm:text-3xl">
          “{CITACAO}”
        </blockquote>
      </div>
    </div>
  );
}

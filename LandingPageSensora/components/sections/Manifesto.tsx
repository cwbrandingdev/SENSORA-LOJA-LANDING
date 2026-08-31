import RevealOnScroll from "@/components/ui/RevealOnScroll";
import TextReveal from "@/components/ui/TextReveal";
import { MANIFESTO_CONTENT } from "@/lib/content";

export default function Manifesto() {
  return (
    <section
      aria-label="Manifesto Sensora"
      className="relative overflow-hidden bg-[#f5f2ed] px-6 py-32 sm:py-40 lg:py-48"
    >
      <RevealOnScroll className="mx-auto flex max-w-3xl flex-col items-center gap-6 text-center">
        <span aria-hidden className="h-px w-12 bg-brand-orange" />
        <p className="font-serif text-3xl leading-snug font-normal tracking-tight text-brand-navy italic sm:text-4xl lg:text-5xl">
          <TextReveal>{MANIFESTO_CONTENT.quote}</TextReveal>
        </p>
      </RevealOnScroll>
    </section>
  );
}

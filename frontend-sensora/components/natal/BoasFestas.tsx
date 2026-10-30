import { Sparkle } from "lucide-react";
import NeveCaindo from "@/components/natal/NeveCaindo";

// Última seção da home no tema de Natal, logo antes do footer: mensagem de
// boas festas com neve. Fundo vermelho-natal escuro para se despedir da
// página e emendar no footer azul.
export default function BoasFestas() {
  return (
    <section
      aria-labelledby="boas-festas-heading"
      className="relative overflow-hidden bg-linear-to-b from-[#7d1f1c] to-[#5c1513] px-6 py-20 text-center text-white sm:py-24"
    >
      <NeveCaindo />
      <div className="relative z-20 mx-auto flex max-w-2xl flex-col items-center gap-5">
        <Sparkle aria-hidden className="natal-estrela h-6 w-6 fill-[#d9b36c] text-[#d9b36c]" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.35em] text-[#d9b36c]">Boas festas</p>
        <h2 id="boas-festas-heading" className="font-serif text-3xl font-normal tracking-tight sm:text-5xl">
          Que o seu Natal seja <span className="italic text-[#d9b36c]">perfumado</span>
        </h2>
        <p className="max-w-lg text-base leading-relaxed text-white/80">
          Obrigado por fazer parte da nossa história este ano. A Sensora deseja a você e a quem você ama um fim de
          ano cheio de aconchego.
        </p>
      </div>
    </section>
  );
}

// Rota pública /faq — mesma Navbar/Footer padrão da Landing (herdados de
// app/(site)/layout.tsx, sem nenhum layout novo). Antes vivia como uma
// seção dentro da Home (ver histórico de app/(site)/page.tsx); agora é uma
// página dedicada, acessível pelo link "Perguntas frequentes" do Footer —
// mesmo componente FaqSection (título/eyebrow/intro + FaqAccordion +
// JSON-LD FAQPage), mesma fonte única de dados (FAQ_ITEMS em lib/content.ts).
import type { Metadata } from "next";
import FaqSection from "@/components/sections/FaqSection";

export const metadata: Metadata = {
  title: "Perguntas frequentes",
};

export default function FaqPage() {
  return <FaqSection />;
}

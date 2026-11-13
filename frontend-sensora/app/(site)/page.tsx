import type { Metadata } from "next";
import HeroCarousel from "@/components/sections/HeroCarousel";
import ProductCategories from "@/components/sections/ProductCategories";
import FeaturedProducts from "@/components/sections/FeaturedProducts";
import LatestReleases from "@/components/sections/LatestReleases";
import AboutSection from "@/components/sections/AboutSection";
import BoasFestas from "@/components/natal/BoasFestas";
import DivisorNatal from "@/components/natal/DivisorNatal";
import FaixaNatal from "@/components/natal/FaixaNatal";
import { slidesDaHome, temaNatalAtivo } from "@/lib/tema-natal";
import { HERO_SLIDES } from "@/lib/content";
import { listarColecoesPublicas } from "@/lib/api-publica";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default async function Home() {
  // Tema de Natal desligado (ver lib/tema-natal.ts): a home fica como
  // sempre foi.
  const colecoes = await listarColecoesPublicas();
  const temaNatal = temaNatalAtivo(colecoes);
  const slides = slidesDaHome(HERO_SLIDES, temaNatal);

  if (!temaNatal) {
    return (
      <>
        <HeroCarousel slides={slides} />
        <ProductCategories />
        <FeaturedProducts />
        <LatestReleases />
        <AboutSection />
      </>
    );
  }

  // Cores, neve e footer de Natal valem no site todo (TemaNatalSite, no
  // layout); aqui entram só os enfeites exclusivos da home.
  return (
    <div className="tema-natal tema-natal-home">
      <HeroCarousel slides={slides} />
      <FaixaNatal />
      <ProductCategories />
      <DivisorNatal />
      {/* Sem divisor depois: sem produto em destaque, esta seção não
          aparece e ficariam dois divisores colados. */}
      <FeaturedProducts />
      <LatestReleases />
      <DivisorNatal />
      <AboutSection />
      <BoasFestas />
    </div>
  );
}

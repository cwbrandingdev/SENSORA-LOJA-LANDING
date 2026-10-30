import type { Metadata } from "next";
import HeroCarousel from "@/components/sections/HeroCarousel";
import ProductCategories from "@/components/sections/ProductCategories";
import FeaturedProducts from "@/components/sections/FeaturedProducts";
import LatestReleases from "@/components/sections/LatestReleases";
import AboutSection from "@/components/sections/AboutSection";
import BoasFestas from "@/components/natal/BoasFestas";
import DivisorNatal from "@/components/natal/DivisorNatal";
import FaixaNatal from "@/components/natal/FaixaNatal";
import { TEMA_NATAL_ATIVO } from "@/lib/tema-natal";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  // Tema de Natal (temporário): desligado em lib/tema-natal.ts, a home
  // fica exatamente como sempre foi.
  if (!TEMA_NATAL_ATIVO) {
    return (
      <>
        <HeroCarousel />
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
    <div className="tema-natal">
      <HeroCarousel />
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

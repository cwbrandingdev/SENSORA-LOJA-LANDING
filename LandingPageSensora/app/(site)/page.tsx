import HeroCarousel from "@/components/sections/HeroCarousel";
import ProductCategories from "@/components/sections/ProductCategories";
import FeaturedProducts from "@/components/sections/FeaturedProducts";
import AboutSection from "@/components/sections/AboutSection";
import Manifesto from "@/components/sections/Manifesto";

export default function Home() {
  return (
    <>
      <HeroCarousel />
      <ProductCategories />
      <FeaturedProducts />
      <AboutSection />
      <Manifesto />
    </>
  );
}

import type { Metadata } from "next";
import HeroCarousel from "@/components/sections/HeroCarousel";
import ProductCategories from "@/components/sections/ProductCategories";
import FeaturedProducts from "@/components/sections/FeaturedProducts";
import LatestReleases from "@/components/sections/LatestReleases";
import AboutSection from "@/components/sections/AboutSection";
import Manifesto from "@/components/sections/Manifesto";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
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

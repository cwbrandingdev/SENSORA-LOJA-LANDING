"use client";

import { usePathname } from "next/navigation";
import Footer from "@/components/layout/Footer";
import { ROUTES } from "@/lib/routes";

export default function SiteFooter() {
  const pathname = usePathname();

  if (pathname === ROUTES.LOJA_CHECKOUT) {
    return null;
  }

  return <Footer />;
}

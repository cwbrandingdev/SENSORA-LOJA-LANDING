import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata = {
  title: {
    default: "Sensora",
    template: "%s — Sensora",
  },
  description: "Velas, difusores e sprays de ambiente Sensora.",
};

export default function SiteLayout({ children }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-sensora-bg font-inter text-brand-navy">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

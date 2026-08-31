import Link from "next/link";
import Image from "next/image";

export function SiteFooter() {
  const ano = new Date().getFullYear();

  return (
    <footer className="mt-auto bg-brand-navy font-inter text-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-16 sm:flex-row sm:items-start sm:justify-between lg:px-10">
        <div className="relative h-6 w-28">
          <Image
            src="/brand/logo.png"
            alt="Sensora"
            fill
            className="object-contain object-left"
          />
        </div>

        <nav className="flex gap-8 text-[13px] uppercase tracking-[0.14em] text-white/70">
          <Link href="/loja" className="transition-colors hover:text-white">
            Início
          </Link>
          <Link href="/loja/produtos" className="transition-colors hover:text-white">
            Catálogo
          </Link>
        </nav>
      </div>

      <div className="border-t border-white/10 px-6 py-6 text-[11px] uppercase tracking-[0.12em] text-white/40 lg:px-10">
        © {ano} Sensora
      </div>
    </footer>
  );
}

// O respiro do topo (altura da navbar fixa) é decidido por CSS, não por
// usePathname(): na Vercel, a regeneração ISR da home renderiza com pathname
// "/index" (não "/"), e o HTML servido saía com o padding — a "barra branca"
// acima do hero. Seções full-bleed que ficam por baixo da navbar marcam-se
// com `data-full-bleed` e zeram o padding via :has().
export default function SiteMain({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 pt-[var(--navbar-height)] has-[>[data-full-bleed]:first-child]:pt-0">
      {children}
    </main>
  );
}

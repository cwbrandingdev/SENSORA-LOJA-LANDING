// A navbar é fixa e sólida (branca, centralizada), então nenhuma seção
// fica por baixo dela — nem o hero da home. O respiro do topo é sempre a
// altura da navbar, decidida em CSS (--navbar-height). Decidir por CSS e
// não por usePathname() evita o problema da regeneração ISR da home na
// Vercel, que renderiza com pathname "/index" (e não "/").
export default function SiteMain({ children }: { children: React.ReactNode }) {
  return <main className="flex-1 pt-[calc(var(--navbar-height)+var(--faixa-cupom))]">{children}</main>;
}

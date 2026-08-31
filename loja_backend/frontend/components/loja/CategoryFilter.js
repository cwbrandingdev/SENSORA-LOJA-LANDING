import Link from "next/link";

// Filtro por categoria via query string (?categoria=slug), resolvido no
// Server Component da página — sem JS de cliente necessário para funcionar.
export function CategoryFilter({ categorias, categoriaAtiva }) {
  if (categorias.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Filtrar por categoria"
      className="flex flex-wrap gap-x-6 gap-y-3 font-inter text-[13px] uppercase tracking-[0.12em]"
    >
      <Link
        href="/loja/produtos"
        className={
          !categoriaAtiva
            ? "text-brand-navy"
            : "text-slate-500 transition-colors hover:text-brand-navy"
        }
      >
        Todos
      </Link>

      {categorias.map((categoria) => {
        const ativo = categoriaAtiva === categoria.slug;
        return (
          <Link
            key={categoria.id}
            href={`/loja/produtos?categoria=${categoria.slug}`}
            className={
              ativo
                ? "text-brand-navy"
                : "text-slate-500 transition-colors hover:text-brand-navy"
            }
          >
            {categoria.nome}
          </Link>
        );
      })}
    </nav>
  );
}

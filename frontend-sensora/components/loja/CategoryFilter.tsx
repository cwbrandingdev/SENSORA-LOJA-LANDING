import Link from "next/link";
import { ROUTES } from "@/lib/routes";
import type { CategoriaPublica } from "@/lib/api-publica";

type CategoryFilterProps = {
  categorias: CategoriaPublica[];
  categoriaAtiva?: string;
};

// Filtro por categoria via query string (?categoria=slug), resolvido no
// Server Component da página — sem JS de cliente necessário para funcionar.
export default function CategoryFilter({ categorias, categoriaAtiva }: CategoryFilterProps) {
  if (categorias.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Filtrar por categoria"
      className="flex flex-wrap gap-x-6 gap-y-3 text-[13px] uppercase tracking-[0.12em]"
    >
      <Link
        href={ROUTES.LOJA_PRODUTOS}
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
            href={`${ROUTES.LOJA_PRODUTOS}?categoria=${encodeURIComponent(categoria.slug)}`}
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

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function getJSON(path) {
  const res = await fetch(`${API_URL}${path}`, { next: { revalidate: 60 } });

  if (res.status === 404) {
    return null;
  }

  if (!res.ok) {
    throw new Error(`Falha ao buscar ${path}: ${res.status}`);
  }

  return res.json();
}

export async function listarProdutosPublicos() {
  const produtos = await getJSON("/public/produtos");
  return produtos ?? [];
}

export async function buscarProdutoPublicoPorSlug(slug) {
  return getJSON(`/public/produtos/${encodeURIComponent(slug)}`);
}

export async function listarCategoriasPublicas() {
  const categorias = await getJSON("/public/categorias");
  return categorias ?? [];
}

"use server";

// Invalidação sob demanda do Data Cache do Next usado pela Loja
// (lib/api-publica.ts). Chamado pelo Admin logo após uma mutação bem
// sucedida (criar/editar/remover produto ou categoria) para que a próxima
// requisição à Loja busque dados frescos, em vez de esperar o teto de 60s
// (`revalidate: 60`) expirar — ver auditoria de latência Admin→Loja.
// `updateTag` (não `revalidateTag`, que no Next 16 passou a exigir um
// segundo argumento de perfil de cache) é a API feita para este caso:
// chamada de dentro de uma Server Action logo após uma mutação, com
// expiração imediata da tag — ver next/dist/server/web/spec-extension/revalidate.js.
import { updateTag } from "next/cache";

export async function revalidarProdutos(): Promise<void> {
  updateTag("produtos");
}

export async function revalidarCategorias(): Promise<void> {
  updateTag("categorias");
  // Produtos embutem a categoria (nome/slug) na resposta pública — uma
  // categoria renomeada só reflete na Loja se a lista de produtos também
  // for revalidada.
  updateTag("produtos");
}

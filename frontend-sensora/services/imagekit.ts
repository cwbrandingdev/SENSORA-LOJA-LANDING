// Mesmo padrão de services/categorias.ts — reaproveita a instância axios
// central (services/api.ts), que já injeta Authorization: Bearer. O backend
// (Etapa 2, GET /imagekit/auth) exige o mesmo JWT usado em /produtos.
import api from "./api";
import type { ImagekitAuthParams } from "@/lib/types/loja";

export async function obterAutenticacaoImageKit(): Promise<ImagekitAuthParams> {
  const response = await api.get<ImagekitAuthParams>("/imagekit/auth");
  return response.data;
}

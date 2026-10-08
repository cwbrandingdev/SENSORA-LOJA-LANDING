// Ocorrências de negócio (GET /admin/ocorrencias, só ADMIN). Filtros vazios
// não são enviados; o backend sempre limita aos últimos 30 dias.
import api from "./api";
import type { FiltrosOcorrencias, PaginaOcorrencias } from "@/lib/types/loja";

export async function listarOcorrencias(
  filtros: FiltrosOcorrencias,
): Promise<PaginaOcorrencias> {
  const response = await api.get<PaginaOcorrencias>("/admin/ocorrencias", {
    params: {
      page: filtros.page ?? 1,
      ...(filtros.tipo ? { tipo: filtros.tipo } : {}),
      ...(filtros.resultado ? { resultado: filtros.resultado } : {}),
    },
  });
  return response.data;
}

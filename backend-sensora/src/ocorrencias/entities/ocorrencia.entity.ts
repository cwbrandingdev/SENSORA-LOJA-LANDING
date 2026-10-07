import { ResultadoOcorrencia } from '../enums/resultado-ocorrencia.enum';
import { TipoOcorrencia } from '../enums/tipo-ocorrencia.enum';

// Contexto operacional permitido em `detalhes` — lista fechada de chaves,
// só números e textos curtos (ver OcorrenciasService.sanitizarDetalhes).
// Nunca payload de gateway, headers, tokens ou dados pessoais.
export interface DetalhesOcorrencia {
  produtoId?: number;
  produtoNome?: string;
  quantidadePedida?: number;
  quantidadeDisponivel?: number;
  unidadesDevolvidas?: number;
  evento?: string;
  statusAnterior?: string;
  statusAtual?: string;
  asaasCode?: string;
  asaasDescription?: string;
}

// Item de GET /admin/ocorrencias. Nome/e-mail do cliente vêm do Usuario
// na consulta (nunca copiados para a ocorrência).
export interface OcorrenciaResposta {
  id: number;
  criadoEm: Date;
  tipo: TipoOcorrencia;
  resultado: ResultadoOcorrencia;
  codigo: string;
  etapa: string;
  mensagem: string;
  usuarioId: number | null;
  cliente: { nome: string; email: string } | null;
  pedidoId: number | null;
  devolucaoId: number | null;
  pedidoNumero: string | null;
  valor: number | null;
  gateway: string | null;
  referenciaExterna: string | null;
  detalhes: DetalhesOcorrencia | null;
}

export interface PaginaOcorrencias {
  items: OcorrenciaResposta[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

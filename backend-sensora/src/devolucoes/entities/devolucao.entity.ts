import { StatusDevolucao } from '../enums/status-devolucao.enum';

export class ItemDevolucao {
  id: number;
  itemPedidoId: number;
  quantidade: number;
  precoUnitario: number;
}

// Foto da devolução. `url` é uma URL assinada de validade curta, gerada a
// cada resposta — nunca a URL pública nem o fileId/caminho do ImageKit.
export class EvidenciaDevolucao {
  id: number;
  url: string;
  criadoEm: Date;
}

// Etapa 8 — o que o cliente vê da logística reversa (só depois de gerada).
// codigoDevolucao: o que ele apresenta nos Correios (pode chegar um pouco
// depois da geração); codigoRastreio: rastreio do objeto, quando houver.
// Nunca o id do envio no provedor, o custo nem a situação crua do provedor.
export class EnvioDevolucaoCliente {
  transportadora: string;
  servico: string;
  codigoDevolucao: string | null;
  codigoRastreio: string | null;
  postadaEm: Date | null;
}

// Etapa 8 — o que o ADMIN vê da logística. compradaEm/geradaEm nulos
// mostram em que passo uma geração interrompida parou.
export class EnvioDevolucaoAdmin {
  servicoId: number;
  transportadora: string;
  servico: string;
  custo: number;
  compradaEm: Date | null;
  geradaEm: Date | null;
  codigoDevolucao: string | null;
  codigoRastreio: string | null;
  postadaEm: Date | null;
  situacaoRastreio: string | null;
  rastreioAtualizadoEm: Date | null;
}

// Recurso secundário: URL do documento do envio gerada na hora (nunca
// guardada). O fluxo principal da devolução é o código de devolução.
export class DocumentoEnvioDevolucao {
  url: string;
}

export class Devolucao {
  id: number;
  pedidoId: number;
  status: StatusDevolucao;
  motivo: string;
  descricao: string | null;
  solicitadaEm: Date;
  // Preenchida quando a devolução é aprovada ou recusada. A observação da
  // análise (observacaoAnalise) não é exposta ao cliente.
  analisadaEm: Date | null;
  itens: ItemDevolucao[];
  evidencias: EvidenciaDevolucao[];
  envio: EnvioDevolucaoCliente | null;
}

// Resposta de GET /pedidos/meus/:id/devolucoes: o histórico do pedido e o
// saldo que ainda pode ser devolvido de cada item (calculado no backend).
export class DevolucoesDoPedido {
  devolucoes: Devolucao[];
  itensDisponiveis: { itemPedidoId: number; quantidadeDisponivel: number }[];
}

// Etapa 7 — fila do Admin (GET /admin/devolucoes). Resumo leve: sem fotos
// (nenhuma URL assinada é gerada na fila) e sem dados internos.
export class DevolucaoResumoAdmin {
  id: number;
  pedidoId: number;
  pedidoNumero: string;
  clienteNome: string | null;
  clienteEmail: string | null;
  status: StatusDevolucao;
  solicitadaEm: Date;
  analisadaEm: Date | null;
  quantidadeItens: number; // soma das unidades pedidas
  quantidadeFotos: number;
}

// Etapa 7 — detalhe para análise do Admin (GET /admin/devolucoes/:id). As
// fotos vêm em URL assinada de validade curta, nunca fileId/caminho.
export class DevolucaoAnalise {
  id: number;
  status: StatusDevolucao;
  motivo: string;
  descricao: string | null;
  solicitadaEm: Date;
  analisadaEm: Date | null;
  observacaoAnalise: string | null;
  analisadoPorNome: string | null;
  recebidaEm: Date | null;
  pedido: {
    id: number;
    numero: string;
    data: Date;
    status: string;
    statusEnvio: string;
    enviadoEm: Date | null;
    total: number;
  };
  cliente: { nome: string | null; email: string | null };
  itens: {
    id: number;
    itemPedidoId: number;
    produtoNome: string;
    quantidade: number;
    quantidadeComprada: number;
    precoUnitario: number;
  }[];
  evidencias: EvidenciaDevolucao[];
  envio: EnvioDevolucaoAdmin | null;
}

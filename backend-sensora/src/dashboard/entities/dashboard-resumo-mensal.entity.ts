import { StatusPedido } from '../../pedidos/enums/status-pedido.enum';

export class ResumoDiaFaturamento {
  /** Dia no calendário de São Paulo (AAAA-MM-DD). */
  dia: string;
  faturamento: number;
  pedidosPagos: number;
}

export class TopProdutoMes {
  produtoId: number;
  nome: string;
  quantidade: number;
  faturamento: number;
}

export class ResumoMesPeriodo {
  ano: number;
  mes: number;
  /** Ex.: "outubro de 2026" (pt-BR). */
  label: string;
  faturamento: number;
  frete: number;
  pedidos: {
    total: number;
    pagos: number;
    porStatus: Record<StatusPedido, number>;
  };
  ticketMedio: number;
  /** Compradores distintos entre pedidos PAGO do mês (usuarioId ou e-mail). */
  clientesUnicos: number;
  /** Soma de Pedido.total com status REEMBOLSADO no mês. */
  valorReembolsado: number;
  porDia: ResumoDiaFaturamento[];
  topProdutos: TopProdutoMes[];
}

export class VariacaoResumoMensal {
  /** Variação percentual (ex.: 12.5 = +12,5%). Null se a base de comparação for zero. */
  faturamento: number | null;
  pedidosPagos: number | null;
  ticketMedio: number | null;
}

export class DashboardResumoMensal {
  periodo: ResumoMesPeriodo;
  comparacao: ResumoMesPeriodo;
  variacao: VariacaoResumoMensal;
}

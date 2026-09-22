import { StatusPedido } from '../../pedidos/enums/status-pedido.enum';

// Vistoria do Dashboard operacional (Admin) — shape de resposta de
// GET /dashboard/resumo, desenhado para bater exatamente com o que
// app/workspace-x/page.tsx (frontend) já calculava sozinho a partir de
// GET /pedidos + /produtos + /categorias: nenhuma informação nova, só a
// mesma agregação movida para o backend (Prisma count/groupBy em vez de
// baixar as listas inteiras e somar em memória, ver DashboardService).
export class ResumoPedidos {
  total: number;
  // Contagem que já alimentava "N pedidos pagos" sob o card de Faturamento
  // (mesmo critério: só PAGO).
  pagos: number;
  // Contagem por status, sempre com as 5 chaves de StatusPedido presentes
  // (0 quando não há nenhum pedido naquele status) — o frontend decide quais
  // exibir (descricaoPorStatus já filtra os que são > 0), o backend nunca
  // omite uma chave.
  porStatus: Record<StatusPedido, number>;
}

export class ResumoProdutos {
  total: number;
  ativos: number;
  // `quantidade === 0` entre os produtos ativos — distinto de estoqueBaixo
  // (0 < quantidade <= LIMIAR_ESTOQUE_BAIXO, ver dashboard.constants.ts).
  // Produto inativo não conta em nenhum dos dois: não está à venda, estoque
  // dele não é uma urgência operacional.
  semEstoque: number;
  estoqueBaixo: number;
}

export class ResumoCategorias {
  total: number;
}

// Clientes reais (Usuario com perfil CLIENTE) — nunca o model `Cliente`
// legado (desconectado de Pedido/Usuario, ver vistoria "Clientes reais").
// Só nome/contagem, nenhum dado individual de cliente: este endpoint é uma
// agregação, não uma listagem — e-mail/CPF/telefone de cada cliente
// continuam só em GET /usuarios e GET /usuarios/:id/detalhes.
export class ResumoClientes {
  total: number;
  ativos: number;
}

export class DashboardResumo {
  // Soma de Pedido.total só entre os PAGO — mesmo critério já usado no card
  // "Faturamento" (frontend) e em ClienteDetalhado.resumo.totalComprado
  // (backend/src/usuarios/entities/cliente-detalhado.entity.ts).
  faturamento: number;
  pedidos: ResumoPedidos;
  produtos: ResumoProdutos;
  categorias: ResumoCategorias;
  clientes: ResumoClientes;
}

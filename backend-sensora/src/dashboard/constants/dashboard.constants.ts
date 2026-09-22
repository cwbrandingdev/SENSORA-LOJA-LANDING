// Vistoria do Dashboard operacional (Admin) — limiar único e centralizado
// para "estoque baixo". Não é uma regra de negócio do catálogo (Produto não
// tem nenhum conceito de "estoque mínimo" hoje, e esta etapa não cria um
// campo novo para isso, ver vistoria) — é só o corte usado pelo card do
// Dashboard para separar "baixo" de "saudável". `0 < quantidade <= LIMIAR`
// conta como baixo; `quantidade === 0` conta como sem estoque (categoria
// própria, ver DashboardService.obterResumo). Ajustar este valor não requer
// migration nem afeta nenhuma outra regra (checkout, ProdutosService.
// removerEstoque etc. continuam validando só quantidade >= 0).
export const LIMIAR_ESTOQUE_BAIXO = 5;

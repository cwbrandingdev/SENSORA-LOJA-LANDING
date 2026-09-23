// Vistoria de Alertas Operacionais (Admin) — limiar único e centralizado
// para o alerta "pedido pago aguardando envio" (nenhum número mágico
// espalhado por AlertasService). Não é uma regra de negócio de logística
// (Pedido/StatusEnvio não têm nenhum conceito de "prazo de despacho" hoje,
// e esta etapa não cria um campo novo para isso) — é só o corte usado pelo
// alerta para separar "aguardando dentro do esperado" de "aguardando ação".
// Ajustar este valor não requer migration nem afeta nenhuma regra de
// pedidos/envio existente (PedidosService.marcarComoEnviado etc. continuam
// aceitando a transição a qualquer momento, independente deste limiar).
export const LIMIAR_DIAS_PEDIDO_SEM_ENVIO = 3;

// Rotas do Admin (frontend) para onde cada alerta direciona o clique —
// espelham frontend-sensora/lib/routes.ts (ROUTES.PRODUTOS/PEDIDOS/
// INTEGRACOES). Sempre a rota BASE, nunca com query string: nenhuma dessas
// páginas lê searchParams hoje (confirmado na vistoria) — um link com
// `?status=...` só produziria um parâmetro ignorado silenciosamente.
// Mantenha sincronizado com lib/routes.ts caso uma dessas rotas mude.
export const LINK_PRODUTOS = '/workspace-x/produtos';
export const LINK_PEDIDOS = '/workspace-x/pedidos';
export const LINK_INTEGRACOES = '/workspace-x/integracoes';

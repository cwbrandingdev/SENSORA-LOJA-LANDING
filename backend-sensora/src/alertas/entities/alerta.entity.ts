// Vistoria de Alertas Operacionais (Admin) — shape de cada item de
// GET /alertas. `tipo` identifica a origem (útil para o frontend escolher
// ícone/tratamento especial no futuro, nunca usado para decidir cor aqui —
// isso é `severidade`); `quantidade` é sempre >= 1 (AlertasService nunca
// inclui um alerta com 0 ocorrências — lista vazia é o estado "sem
// alertas", nunca um item com quantidade zerada). `link` é sempre uma rota
// BASE do Admin (nunca query string — ver constants/alertas.constants.ts).
export type AlertaTipo =
  | 'ESTOQUE_BAIXO'
  | 'REEMBOLSO_SOLICITADO'
  | 'PEDIDO_AGUARDANDO_ENVIO'
  | 'MELHOR_ENVIO_DESCONECTADO';

// Duas severidades bastam para os 4 alertas desta etapa (mesmos tons já
// usados pelo componente Badge do frontend — nenhum tom novo é criado
// aqui: `warning`/`danger` já existem em components/ui/Badge.tsx).
export type AlertaSeveridade = 'warning' | 'danger';

export class Alerta {
  tipo: AlertaTipo;
  severidade: AlertaSeveridade;
  titulo: string;
  quantidade: number;
  link: string;
}

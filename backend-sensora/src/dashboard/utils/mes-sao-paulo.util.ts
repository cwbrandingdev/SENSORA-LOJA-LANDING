const FUSO_SP = 'America/Sao_Paulo';

/** Primeiro instante do mês e primeiro instante do mês seguinte (fuso SP). */
export function intervaloMesSaoPaulo(
  ano: number,
  mes: number,
): { inicio: Date; fim: Date } {
  const mesStr = String(mes).padStart(2, '0');
  const inicio = new Date(`${ano}-${mesStr}-01T00:00:00-03:00`);
  const proximoAno = mes === 12 ? ano + 1 : ano;
  const proximoMes = mes === 12 ? 1 : mes + 1;
  const proximoMesStr = String(proximoMes).padStart(2, '0');
  const fim = new Date(`${proximoAno}-${proximoMesStr}-01T00:00:00-03:00`);
  return { inicio, fim };
}

export function mesAtualSaoPaulo(): { ano: number; mes: number } {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_SP,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date());
  const ano = Number(partes.find((p) => p.type === 'year')?.value);
  const mes = Number(partes.find((p) => p.type === 'month')?.value);
  return { ano, mes };
}

export function mesAnterior(ano: number, mes: number): { ano: number; mes: number } {
  if (mes === 1) return { ano: ano - 1, mes: 12 };
  return { ano, mes: mes - 1 };
}

export function labelMesSaoPaulo(ano: number, mes: number): string {
  const { inicio } = intervaloMesSaoPaulo(ano, mes);
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO_SP,
    month: 'long',
    year: 'numeric',
  }).format(inicio);
}

/** Converte `Pedido.data` para AAAA-MM-DD no calendário de São Paulo. */
export function diaPedidoSaoPaulo(data: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_SP,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(data);
}

export function variacaoPercentual(atual: number, anterior: number): number | null {
  if (anterior === 0) return atual === 0 ? 0 : null;
  return ((atual - anterior) / anterior) * 100;
}

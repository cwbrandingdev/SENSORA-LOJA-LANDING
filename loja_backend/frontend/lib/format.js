const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatBRL(value) {
  const n = Number(value);
  return Number.isFinite(n) ? currencyFormatter.format(n) : value;
}

const formatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function ProductPrice({ value, className }) {
  const numero = typeof value === "string" ? Number(value) : value;

  if (typeof numero !== "number" || Number.isNaN(numero)) {
    return null;
  }

  return <span className={className}>{formatter.format(numero)}</span>;
}

/** URL pública do Melhor Rastreio (ecossistema Melhor Envio) para um código. */
export function urlMelhorRastreio(codigoRastreio: string): string {
  const codigo = codigoRastreio.trim();
  if (!codigo) {
    return "https://www.melhorrastreio.com.br/";
  }
  return `https://www.melhorrastreio.com.br/meu-rastreio/${encodeURIComponent(codigo)}`;
}

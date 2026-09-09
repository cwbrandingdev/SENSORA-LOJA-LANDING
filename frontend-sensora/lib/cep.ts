// Mesmo padrão de lib/cpf.ts/lib/telefone.ts — só normalização de
// apresentação, nunca substitui a validação real (CreateEnderecoDto no
// backend e o regex de EnderecoForm já aceitam CEP com ou sem hífen).

export function normalizarCep(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function cepCompleto(valor: string): boolean {
  return normalizarCep(valor).length === 8;
}

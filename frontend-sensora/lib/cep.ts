// Mesmo padrão de lib/cpf.ts/lib/telefone.ts — só normalização de
// apresentação, nunca substitui a validação real (CreateEnderecoDto no
// backend e o regex de EnderecoForm já aceitam CEP com ou sem hífen).

export function normalizarCep(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function cepCompleto(valor: string): boolean {
  return normalizarCep(valor).length === 8;
}

// Máscara 00000-000 enquanto a pessoa digita: só dígitos (no máximo 8), com
// o hífen depois do quinto.
export function formatarCep(valor: string): string {
  const digitos = normalizarCep(valor).slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

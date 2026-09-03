// Etapa — Dados do Cliente / Cadastro. Espelho no frontend de
// backend/src/common/utils/cpf.util.ts (mesmo algoritmo de dígitos
// verificadores) — usado só para feedback imediato de UX em Minha Conta.
// NUNCA substitui a validação do backend: o valor final sempre é
// revalidado/normalizado lá antes de persistir (ver
// UsuariosService.atualizarMeusDados).

export function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, "");
}

function calcularDigitoVerificador(digitos: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < digitos.length; i += 1) {
    soma += Number(digitos[i]) * (pesoInicial - i);
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(valor: string): boolean {
  const cpf = normalizarCpf(valor);

  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const primeiroDigito = calcularDigitoVerificador(cpf.slice(0, 9), 10);
  if (primeiroDigito !== Number(cpf[9])) return false;

  const segundoDigito = calcularDigitoVerificador(cpf.slice(0, 10), 11);
  if (segundoDigito !== Number(cpf[10])) return false;

  return true;
}

// Só apresentação ("123.456.789-09") — o valor enviado ao backend nunca
// precisa estar formatado (o backend normaliza de qualquer forma), mas
// mandar formatado também funciona sem diferença de comportamento.
export function formatarCpf(valor: string): string {
  const digitos = normalizarCpf(valor).slice(0, 11);
  let formatado = digitos.slice(0, 3);
  if (digitos.length > 3) formatado += `.${digitos.slice(3, 6)}`;
  if (digitos.length > 6) formatado += `.${digitos.slice(6, 9)}`;
  if (digitos.length > 9) formatado += `-${digitos.slice(9, 11)}`;
  return formatado;
}

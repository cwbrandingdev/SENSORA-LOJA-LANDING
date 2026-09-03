// Etapa — Dados do Cliente / Cadastro. Única fonte de verdade para
// normalização/validação de CPF — usado por UsuariosService (self-service
// e administrativo). Implementa o algoritmo real de dígitos verificadores
// (módulo 11), não uma checagem superficial de formato: rejeita CPFs com
// os 11 dígitos iguais (matematicamente "válidos" pelo módulo 11, mas nunca
// emitidos de verdade) e qualquer CPF cujos dígitos verificadores não
// batam com os 9 primeiros dígitos.

// Remove tudo que não for dígito — aceita CPF formatado ("123.456.789-09")
// ou já normalizado ("12345678909") na entrada.
export function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, '');
}

function calcularDigitoVerificador(digitos: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < digitos.length; i += 1) {
    soma += Number(digitos[i]) * (pesoInicial - i);
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

// Sempre normaliza internamente antes de validar — aceita a mesma entrada
// (formatada ou não) que normalizarCpf().
export function cpfValido(valor: string): boolean {
  const cpf = normalizarCpf(valor);

  if (cpf.length !== 11) {
    return false;
  }

  // "11111111111", "22222222222" etc. — matematicamente passariam no
  // módulo 11 abaixo, mas nunca são CPFs reais emitidos pela Receita.
  if (/^(\d)\1{10}$/.test(cpf)) {
    return false;
  }

  const primeiroDigitoEsperado = calcularDigitoVerificador(cpf.slice(0, 9), 10);
  if (primeiroDigitoEsperado !== Number(cpf[9])) {
    return false;
  }

  const segundoDigitoEsperado = calcularDigitoVerificador(cpf.slice(0, 10), 11);
  if (segundoDigitoEsperado !== Number(cpf[10])) {
    return false;
  }

  return true;
}

// Etapa — Dados do Cliente / Cadastro. Espelho no frontend de
// backend/src/common/utils/telefone.util.ts — feedback imediato de UX em
// Minha Conta, nunca substitui a validação/normalização do backend.

export function normalizarTelefone(valor: string): string {
  return valor.replace(/\D/g, "");
}

// DDD (2 dígitos) + fixo (8) ou celular (9) = 10 ou 11 dígitos.
export function telefoneValido(valor: string): boolean {
  const telefone = normalizarTelefone(valor);
  return /^\d{10,11}$/.test(telefone);
}

// Só apresentação — "(41) 99999-9999" (celular, 11 dígitos) ou
// "(41) 3333-3333" (fixo, 10 dígitos), formatando progressivamente enquanto
// o usuário digita.
export function formatarTelefone(valor: string): string {
  const digitos = normalizarTelefone(valor).slice(0, 11);

  if (digitos.length === 0) return "";
  if (digitos.length <= 2) return `(${digitos}`;

  const ddd = digitos.slice(0, 2);
  const resto = digitos.slice(2);

  if (resto.length <= 4) return `(${ddd}) ${resto}`;

  // 11 dígitos totais = celular (5+4); 10 ou menos = fixo (4+4).
  const tamanhoPrimeiroBloco = digitos.length > 10 ? 5 : 4;
  const primeiroBloco = resto.slice(0, tamanhoPrimeiroBloco);
  const segundoBloco = resto.slice(tamanhoPrimeiroBloco);
  return segundoBloco ? `(${ddd}) ${primeiroBloco}-${segundoBloco}` : `(${ddd}) ${primeiroBloco}`;
}

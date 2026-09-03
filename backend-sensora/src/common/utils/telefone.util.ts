// Etapa — Dados do Cliente / Cadastro. Normalização/validação de telefone —
// só comprimento (DDD + número), sem checagem de DDD específico (códigos de
// área mudam com o tempo; validar contra uma lista fixa seria fragilidade
// desnecessária para o que a tarefa pede). Aceita qualquer formatação comum
// brasileira na entrada: "(41) 99999-9999", "41999999999", "(41) 3333-3333",
// "4133333333".

// Remove tudo que não for dígito.
export function normalizarTelefone(valor: string): string {
  return valor.replace(/\D/g, '');
}

// DDD (2 dígitos) + fixo (8 dígitos) = 10, ou DDD + celular (9 dígitos) = 11.
export function telefoneValido(valor: string): boolean {
  const telefone = normalizarTelefone(valor);
  return /^\d{10,11}$/.test(telefone);
}

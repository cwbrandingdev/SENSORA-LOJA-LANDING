// Escapa texto antes de colocá-lo dentro do HTML de um e-mail, para que
// nome, motivo, observação etc. apareçam como texto e nunca virem marcação.
export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

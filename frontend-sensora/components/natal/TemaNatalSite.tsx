import NeveCaindo from "@/components/natal/NeveCaindo";
import "@/components/natal/tema-natal.css";

// Liga o tema de Natal no site inteiro (vem do layout da loja quando
// TEMA_NATAL_ATIVO está ligado): o marcador .tema-natal ativa o CSS do
// tema em todas as páginas, e a neve leve cai por cima de tudo, por baixo
// do menu.
export default function TemaNatalSite() {
  return (
    <>
      <span className="tema-natal" hidden />
      <NeveCaindo fixo quantidade={45} />
    </>
  );
}

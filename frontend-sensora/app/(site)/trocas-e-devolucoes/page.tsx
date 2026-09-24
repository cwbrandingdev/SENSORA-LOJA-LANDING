import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Secao } from "@/components/legal/LegalDocument";
import { EMPRESA, ROTAS_LEGAIS, mailtoAssunto } from "@/lib/empresa";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Trocas e devoluções",
  description:
    "Direito de arrependimento de 7 dias e garantia legal por defeito nas compras da Sensora.",
};

const mailtoArrependimento = mailtoAssunto(
  "Arrependimento de compra — Sensora",
  "Olá, quero exercer o direito de arrependimento (7 dias após o recebimento).\n\nNúmero do pedido:\nNome:\nE-mail da conta:\nData em que recebi:\n",
);

const mailtoDefeito = mailtoAssunto(
  "Defeito no produto — Sensora",
  "Olá, quero acionar a garantia por defeito.\n\nNúmero do pedido:\nProduto:\nO que aconteceu:\nData em que recebi:\n",
);

export default function TrocasEDevolucoesPage() {
  return (
    <LegalPage
      title="Trocas e devoluções"
      intro="Dois direitos já nascem com a compra feita neste site. Esta página diz como usar cada um. Não existe troca por preferência de aroma, cor ou presente fora deles."
    >
      <Secao title="Arrependimento: 7 dias">
        <p>
          Pelo artigo 49 do Código de Defesa do Consumidor, você pode desistir
          da compra em 7 dias contados do recebimento do produto. Não precisa
          haver defeito e não precisa explicar o motivo.
        </p>
        <p>
          A loja devolve de imediato o valor pago, incluindo o frete da ida,
          pelo mesmo meio de pagamento sempre que ele permitir. O frete da
          devolução, nesse caso, é por conta da {EMPRESA.razaoSocial}. Não
          exigimos lacre intacto como condição desse direito.
        </p>
        <p>
          Envie o pedido para{" "}
          <a
            href={mailtoArrependimento}
            className="text-brand-navy underline underline-offset-4"
          >
            {EMPRESA.emailSuporte}
          </a>{" "}
          com o número do pedido, que está em{" "}
          <Link href={ROUTES.CONTA_PEDIDOS} className="text-brand-navy underline underline-offset-4">
            Minha Conta → Meus Pedidos
          </Link>
          . A resposta de recebimento sai por esse mesmo e-mail, com a
          orientação de postagem.
        </p>
      </Secao>

      <Secao title="Defeito: 30 dias">
        <p>
          Vela, spray e difusor são produtos de consumo. A garantia legal por
          vício é de 30 dias contados do recebimento. Se o produto vier com
          defeito (vazamento, item faltando no kit, dano que não seja mau uso),
          escreva para{" "}
          <a href={mailtoDefeito} className="text-brand-navy underline underline-offset-4">
            {EMPRESA.emailSuporte}
          </a>
          .
        </p>
        <p>
          Se o problema não for resolvido em 30 dias, você escolhe entre troca,
          abatimento do preço ou dinheiro de volta, nos termos do artigo 18 do
          Código de Defesa do Consumidor.
        </p>
      </Secao>

      <Secao title="O que esta loja não troca">
        <p>
          Não há troca porque o aroma, a cor ou o presente não era o que você
          esperava, depois de passado o prazo de arrependimento, nem quando o
          produto foi danificado por uso fora das instruções da página e da
          embalagem (vela deixada sem supervisão, spray ou difusor ingerido ou
          aplicado na pele, por exemplo).
        </p>
      </Secao>

      <Secao title="Nota fiscal na devolução">
        <p>
          A nota da venda é emitida no CPF cadastrado. Guarde o documento: ele
          identifica a compra no arrependimento e na garantia. Se não tiver
          recebido, peça em {EMPRESA.emailSuporte}. As condições gerais da compra
          estão nos{" "}
          <Link href={ROTAS_LEGAIS.termos} className="text-brand-navy underline underline-offset-4">
            Termos de Uso
          </Link>
          .
        </p>
      </Secao>
    </LegalPage>
  );
}

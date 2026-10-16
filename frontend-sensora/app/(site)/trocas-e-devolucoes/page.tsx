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

const linkClass = "text-brand-navy underline underline-offset-4";

export default function TrocasEDevolucoesPage() {
  return (
    <LegalPage
      title="Trocas e devoluções"
      intro={`A ${EMPRESA.nomeFantasia} vende velas aromáticas, sprays de ambiente e difusores pela loja online. Esta política segue o Código de Defesa do Consumidor (Lei 8.078/1990) e descreve os dois direitos da compra feita neste site: arrependimento e garantia por defeito. Não existe troca comercial por preferência de aroma, cor ou presente fora desses direitos. Atualizada em ${EMPRESA.atualizadoEm}.`}
    >
      <Secao title="Qual o prazo para solicitar a devolução">
        <p>
          Pelo artigo 49 do Código de Defesa do Consumidor, você pode desistir
          da compra em até <strong>7 dias</strong> contados do recebimento do
          produto. É o direito de arrependimento: não precisa haver defeito e
          não precisa explicar o motivo. Produto em promoção continua com esse
          prazo — ele não pode ser afastado.
        </p>
        <p>
          Não oferecemos um prazo extra de 30 dias para trocar por outro
          produto só porque o aroma, a cor ou o presente não agradou. Vela,
          spray e difusor são escolhas pessoais de fragrância; depois dos 7
          dias, a devolução fica reservada ao defeito.
        </p>
      </Secao>

      <Secao title="E se o produto adquirido apresentar defeito">
        <p>
          Vela, spray e difusor são produtos de consumo. A garantia legal por
          vício aparente ou de fácil constatação é de <strong>30 dias</strong>{" "}
          contados do recebimento (artigo 26 do CDC). Entre em contato se
          houver vazamento, item faltando no kit, avaria de transporte ou
          outro defeito que não seja mau uso.
        </p>
        <p>
          Escreva para{" "}
          <a href={mailtoDefeito} className={linkClass}>
            {EMPRESA.emailSuporte}
          </a>{" "}
          descrevendo o problema ou use o botão{" "}
          <strong>Solicitar devolução</strong> no pedido. Se o vício não for
          sanado em 30 dias, você escolhe entre troca, abatimento do preço ou
          dinheiro de volta, nos termos do artigo 18 do CDC.
        </p>
      </Secao>

      <Secao title="Como solicito a troca ou a devolução">
        <p>
          O caminho principal é a conta, não um e-mail solto. Assim a
          solicitação fica no histórico do pedido e a loja consegue gerar o
          código de postagem.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>
            Entre em{" "}
            <Link href={ROUTES.CONTA_PEDIDOS} className={linkClass}>
              Minha Conta → Meus Pedidos
            </Link>
            , abra o pedido e clique em <strong>Solicitar devolução</strong>.
            O botão aparece depois que o pedido já foi enviado.
          </li>
          <li>
            Escolha os itens e as quantidades, informe o motivo e, se quiser,
            envie fotos (úteis sobretudo em caso de defeito).
          </li>
          <li>
            A solicitação é analisada pela loja. Você recebe a decisão por
            e-mail. Se for aprovada, o código de devolução e as instruções de
            envio entram no próprio pedido e também no e-mail.
          </li>
        </ol>
        <p>
          Dúvidas, ou não conseguiu usar o formulário? Escreva para{" "}
          <a href={mailtoArrependimento} className={linkClass}>
            {EMPRESA.emailSuporte}
          </a>{" "}
          com o número do pedido. Também dá para abrir um chamado em Minha
          Conta → Suporte.
        </p>
      </Secao>

      <Secao title="Como envio o produto de volta">
        <p>
          Depois da aprovação, a loja gera um código de devolução pelos
          Correios (via Melhor Envio). O frete da volta é pago pela{" "}
          {EMPRESA.razaoSocial}. Você não precisa imprimir etiqueta.
        </p>
        <ol className="list-decimal space-y-2 pl-5">
          <li>Embale o produto. Sempre que possível, use a embalagem original e inclua acessórios do kit (por exemplo, varetas do difusor).</li>
          <li>
            Leve o pacote a uma agência dos Correios e apresente o código de
            devolução. O código tem prazo de validade: poste o quanto antes.
          </li>
          <li>
            Acompanhe o status em Meus Pedidos. Quando a loja receber e
            conferir, o reembolso segue.
          </li>
        </ol>
        <p>
          No direito de arrependimento não exigimos lacre intacto. Produto
          danificado por uso fora das instruções da página e da embalagem
          (vela acesa sem supervisão, spray ou difusor ingerido ou aplicado na
          pele, por exemplo) pode ser recusado na conferência.
        </p>
      </Secao>

      <Secao title="Em quanto tempo receberei o ressarcimento">
        <p>
          O reembolso começa depois que o produto volta, a loja confere o que
          foi aceito e o Asaas confirma o estorno. Devolvemos o valor dos
          itens aceitos, pelo mesmo meio de pagamento da compra sempre que ele
          permitir.
        </p>
        <p>
          No arrependimento da compra inteira, o frete da ida também é
          devolvido. Devolução parcial cobre o valor dos itens devolvidos.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Cartão de crédito:</strong> o cancelamento é pedido à
            administradora. O crédito costuma aparecer em até duas faturas,
            conforme a operadora.
          </li>
          <li>
            <strong>Pix:</strong> o valor volta à conta de origem depois que
            o Asaas confirma o estorno, em geral em poucos dias úteis.
          </li>
        </ul>
        <p>
          Se na conferência o produto não corresponder a esta política, a
          devolução pode ser recusada e o item reenviado ao endereço de
          origem.
        </p>
      </Secao>

      <Secao title="E se o pedido ainda não foi enviado">
        <p>
          Pedido pago que ainda não saiu para entrega não precisa de
          logística reversa. Em Meus Pedidos, use{" "}
          <strong>Solicitar reembolso</strong>. O estorno segue pelo Asaas,
          no mesmo meio da compra.
        </p>
      </Secao>

      <Secao title="Posso trocar na loja física ou em um parceiro">
        <p>
          A {EMPRESA.nomeFantasia} opera só pela loja online. Não há loja
          física para troca presencial. Produtos comprados em outros sites,
          marketplaces ou revendedores não são devolvidos por aqui — o
          atendimento é com quem vendeu.
        </p>
      </Secao>

      <Secao title="O que esta loja não troca">
        <p>
          Não há troca porque o aroma, a cor ou o presente não era o que você
          esperava, depois de passado o prazo de arrependimento. Também não
          cobrimos dano causado por uso fora das instruções da página do
          produto e da embalagem.
        </p>
      </Secao>

      <Secao title="Nota fiscal na devolução">
        <p>
          A nota da venda é emitida no CPF cadastrado. Guarde o documento: ele
          identifica a compra no arrependimento e na garantia. Se não tiver
          recebido, peça em {EMPRESA.emailSuporte}. As condições gerais da
          compra estão nos{" "}
          <Link href={ROTAS_LEGAIS.termos} className={linkClass}>
            Termos de Uso
          </Link>
          .
        </p>
      </Secao>
    </LegalPage>
  );
}

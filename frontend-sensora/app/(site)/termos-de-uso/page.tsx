import type { Metadata } from "next";
import Link from "next/link";
import IdentificacaoFornecedor from "@/components/legal/IdentificacaoFornecedor";
import { LegalPage, Secao } from "@/components/legal/LegalDocument";
import { EMPRESA, ROTAS_LEGAIS } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description:
    "Condições de uso da loja Sensora, operada pela Cazarim & Souza Ltda: compra, entrega, pagamento, arrependimento e garantia.",
};

const linkClass = "text-brand-navy underline underline-offset-4";

export default function TermosDeUsoPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      intro={`Estas são as condições da loja online da ${EMPRESA.razaoSocial}, marca ${EMPRESA.nomeFantasia}. Ao criar uma conta ou concluir uma compra, você contrata com essa empresa. O que limita direito do consumidor está nesta página e na de trocas, em destaque. Atualizado em ${EMPRESA.atualizadoEm}.`}
    >
      <Secao title="Quem vende">
        <IdentificacaoFornecedor />
        <p>
          A loja opera só pela internet. Não há ponto de venda físico da
          marca. Dúvidas institucionais: {EMPRESA.email}. Pós-venda, nota
          fiscal e dados pessoais: {EMPRESA.emailSuporte}.
        </p>
      </Secao>

      <Secao title="O que é vendido">
        <p>
          Velas aromáticas, sprays de ambiente, difusores de aroma e kits
          desses produtos. Eles perfumam o ambiente. Não são cosmético, não
          são saneante e não têm efeito terapêutico, medicinal ou de
          desinfecção. Características, preço, estoque e riscos de uso (fogo,
          ingestão, crianças e animais) estão na página de cada item.
        </p>
        <p>
          Promoções valem pelo prazo indicado ou enquanto durar o estoque.
          Preço e disponibilidade podem mudar até o pagamento ser confirmado.
        </p>
      </Secao>

      <Secao title="Conta">
        <p>
          A compra pede uma conta com nome, e-mail, senha e, para a nota,
          CPF no cadastro. Você é responsável por manter a senha e por dados
          verdadeiros. Telefone é pedido no checkout porque a transportadora
          usa o número na etiqueta. O tratamento desses dados está na{" "}
          <Link href={ROTAS_LEGAIS.privacidade} className={linkClass}>
            Política de Privacidade
          </Link>
          .
        </p>
      </Secao>

      <Secao title="Preço, frete e pagamento">
        <p>
          O preço do produto aparece em reais na página. O frete, com valor e
          prazo em dias úteis, é calculado no checkout a partir do endereço
          escolhido, antes do pagamento. O total é a soma dos itens e do
          frete selecionado. Não há taxa escondida nesta etapa.
        </p>
        <p>
          O pagamento é Pix ou cartão de crédito, no ambiente seguro do
          Asaas. A Sensora não recebe o número do cartão. O pedido só segue
          depois da confirmação do pagamento. Não há boleto, vale-troca nem
          cartão-presente neste site.
        </p>
      </Secao>

      <Secao title="Área de entrega">
        <p>
          Por enquanto a loja entrega em um raio de 100 km a partir de
          Curitiba (região metropolitana). Se o CEP estiver fora dessa área,
          o checkout avisa e a compra não segue. O prazo mostrado é
          estimativa da transportadora em dias úteis e começa a contar após a
          postagem.
        </p>
        <p>
          A entrega é no endereço informado, pela opção escolhida no
          checkout. O risco do produto permanece com a loja até a entrega
          efetiva a você. Pedido pago e ainda não enviado pode ter o endereço
          alterado para outro no mesmo CEP, em Meus Pedidos.
        </p>
      </Secao>

      <Secao title="Nota fiscal">
        <p>
          A {EMPRESA.razaoSocial} é optante pelo Simples Nacional e emite
          nota fiscal eletrônica da venda de mercadoria. O documento sai no
          CPF cadastrado e é enviado ao e-mail da compra ou mediante pedido
          para{" "}
          <a href={`mailto:${EMPRESA.emailSuporte}`} className={linkClass}>
            {EMPRESA.emailSuporte}
          </a>
          . Se o CPF estiver em branco, pedimos antes de emitir.
        </p>
      </Secao>

      <Secao title="Cancelamento, arrependimento e defeito">
        <p>
          Pedido pago que ainda não foi enviado pode ser desfeito em Meus
          Pedidos, por <strong>Solicitar reembolso</strong>.
        </p>
        <p>
          Depois do recebimento, a compra feita por este site pode ser
          desfeita em 7 dias, sem necessidade de defeito e sem justificativa.
          Defeito do produto segue a garantia legal de 30 dias, por serem
          produtos de consumo. Não há troca por preferência de aroma, cor ou
          presente fora desses dois direitos.
        </p>
        <p>
          O passo a passo, inclusive código de postagem, quem paga o frete de
          volta e os prazos de estorno no Pix e no cartão, está em{" "}
          <Link href={ROTAS_LEGAIS.trocas} className={linkClass}>
            Trocas e devoluções
          </Link>
          .
        </p>
      </Secao>

      <Secao title="Atendimento">
        <p>
          Com conta, abra uma solicitação em Minha Conta → Suporte: a
          resposta chega por e-mail. Também atendemos em {EMPRESA.email} e{" "}
          {EMPRESA.emailSuporte}, e pelo Instagram {EMPRESA.instagram}. Pedidos
          pagos aparecem em Minha Conta → Meus Pedidos.
        </p>
      </Secao>

      <Secao title="Uso do site">
        <p>
          O conteúdo da loja (textos, fotos e a marca) pertence à empresa ou
          é usado com licença. Não é permitido usar o site para fraude,
          ataque ou coleta de dados de outras pessoas.
        </p>
        <p>
          Cookies essenciais e opcionais estão descritos na{" "}
          <Link href={ROTAS_LEGAIS.cookies} className={linkClass}>
            Política de Cookies
          </Link>
          .
        </p>
      </Secao>

      <Secao title="Alterações destes termos">
        <p>
          A versão vigente é a publicada nesta página, com a data no início.
          Mudança que afete a compra vale para pedidos feitos depois da
          publicação. Direito já nascido na compra (arrependimento, garantia,
          nota) continua o da data do pedido.
        </p>
      </Secao>

      <Secao title="Foro">
        <p>
          Vale a lei brasileira. Você pode propor ação no foro do seu
          domicílio. Qualquer texto que afaste o arrependimento de 7 dias,
          reduza a garantia legal ou eleja foro exclusivo da empresa não se
          aplica.
        </p>
      </Secao>
    </LegalPage>
  );
}

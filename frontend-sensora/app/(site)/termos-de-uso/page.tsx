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

export default function TermosDeUsoPage() {
  return (
    <LegalPage
      title="Termos de Uso"
      intro={`Estas são as condições da loja online da ${EMPRESA.razaoSocial}. Atualizado em ${EMPRESA.atualizadoEm}. O que limita direito do consumidor está nesta página e na de trocas, em destaque.`}
    >
      <Secao title="Quem vende">
        <IdentificacaoFornecedor />
        <p>
          Ao criar uma conta ou concluir uma compra, você contrata com essa
          empresa, que usa a marca {EMPRESA.nomeFantasia}.
        </p>
      </Secao>

      <Secao title="O que é vendido">
        <p>
          Velas aromáticas, sprays de ambiente, difusores de aroma e kits
          desses produtos. Eles perfumam o ambiente. Não são cosmético, não
          são saneante e não têm efeito terapêutico, medicinal ou de
          desinfecção. Características, preço e disponibilidade de cada item
          estão na página do produto. Riscos de uso (fogo, ingestão, crianças
          e animais) também.
        </p>
      </Secao>

      <Secao title="Conta">
        <p>
          A compra pede uma conta com nome, e-mail e senha. Você é responsável
          por manter a senha e por dados verdadeiros. CPF e telefone são
          opcionais no cadastro; o CPF é o dado usado na nota fiscal. Se
          estiver em branco, pedimos por e-mail antes de emitir o documento.
        </p>
      </Secao>

      <Secao title="Preço, frete e pagamento">
        <p>
          O preço do produto aparece em reais na página. O frete, com valor e
          prazo em dias úteis, é calculado no checkout a partir do endereço
          escolhido, antes do pagamento. O total é a soma dos itens e do frete
          selecionado. Não há taxa escondida nesta etapa.
        </p>
        <p>
          O pagamento é concluído no ambiente seguro do Asaas. A Sensora não
          recebe o número do cartão. O pedido só segue depois da confirmação
          do pagamento.
        </p>
      </Secao>

      <Secao title="Entrega">
        <p>
          A entrega é feita pela transportadora escolhida no checkout, no
          endereço informado. O prazo mostrado é estimativa da transportadora
          em dias úteis e começa a contar após a postagem. O risco do produto
          permanece com a loja até a entrega efetiva a você.
        </p>
      </Secao>

      <Secao title="Nota fiscal">
        <p>
          A {EMPRESA.razaoSocial} é optante pelo Simples Nacional e emite nota
          fiscal eletrônica da venda de mercadoria. O documento sai no CPF
          cadastrado e é enviado ao e-mail da compra ou mediante pedido para{" "}
          <a
            href={`mailto:${EMPRESA.email}`}
            className="text-brand-navy underline underline-offset-4"
          >
            {EMPRESA.email}
          </a>
          .
        </p>
      </Secao>

      <Secao title="Arrependimento e defeito">
        <p>
          Compra feita por este site pode ser desfeita em 7 dias contados do
          recebimento, sem necessidade de defeito e sem justificativa. Defeito
          do produto segue a garantia legal de 30 dias, por serem produtos de
          consumo. Não há troca por preferência de aroma, cor ou presente fora
          desses dois direitos.
        </p>
        <p>
          O passo a passo, inclusive o que é devolvido em dinheiro e quem paga
          o frete de volta, está em{" "}
          <Link href={ROTAS_LEGAIS.trocas} className="text-brand-navy underline underline-offset-4">
            Trocas, devoluções e arrependimento
          </Link>
          .
        </p>
      </Secao>

      <Secao title="Atendimento">
        <p>
          Dúvida, reclamação, informação sobre pedido e cancelamento entram
          pelo e-mail {EMPRESA.email}. O recebimento da mensagem é confirmado
          por resposta nesse mesmo e-mail. Pedidos pagos também aparecem em
          Minha Conta → Meus Pedidos.
        </p>
      </Secao>

      <Secao title="Uso do site">
        <p>
          O conteúdo da loja (textos, fotos e a marca) pertence à empresa ou
          é usado com licença. Não é permitido usar o site para fraude, ataque
          ou coleta de dados de outras pessoas.
        </p>
        <p>
          O tratamento de dados pessoais está na{" "}
          <Link
            href={ROTAS_LEGAIS.privacidade}
            className="text-brand-navy underline underline-offset-4"
          >
            Política de Privacidade
          </Link>
          .
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

import type { Metadata } from "next";
import Link from "next/link";
import IdentificacaoFornecedor from "@/components/legal/IdentificacaoFornecedor";
import { LegalPage, Secao } from "@/components/legal/LegalDocument";
import { EMPRESA, ROTAS_LEGAIS, mailtoAssunto } from "@/lib/empresa";
import { ROUTES } from "@/lib/routes";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description:
    "Como a Cazarim & Souza Ltda (Sensora) trata dados pessoais na loja, com base na LGPD.",
};

const mailtoPrivacidade = mailtoAssunto(
  "Privacidade — pedido de titular (LGPD)",
  "Olá,\n\nQuero exercer um direito de titular de dados (acesso, correção, exclusão ou informação sobre compartilhamento).\n\nNome:\nE-mail da conta:\nPedido:\n",
);

export default function PoliticaDePrivacidadePage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      intro={`Esta política explica quais dados a loja trata, para quê e como falar com a gente. Atualizada em ${EMPRESA.atualizadoEm}.`}
    >
      <Secao title="Quem é o controlador">
        <p>
          O controlador dos dados pessoais coletados neste site é a{" "}
          {EMPRESA.razaoSocial}, nome fantasia {EMPRESA.nomeFantasia}.
        </p>
        <IdentificacaoFornecedor />
        <p>
          A empresa é microempresa optante pelo Simples Nacional. O canal do
          titular é o e-mail acima — use-o para qualquer pedido sobre os seus
          dados. Não há outro encarregado publicado além desse canal.
        </p>
      </Secao>

      <Secao title="Quais dados usamos">
        <ul className="list-disc space-y-2 pl-5">
          <li>Cadastro: nome, e-mail e senha de acesso.</li>
          <li>Opcionais no perfil: CPF e telefone.</li>
          <li>Endereços de entrega que você salva.</li>
          <li>
            Pedido: itens, quantidades, frete escolhido, valor e status de
            pagamento e de envio.
          </li>
          <li>
            Preferência de cookies, gravada no seu navegador, e o necessário
            para manter login, carrinho e a volta do checkout. O detalhe está
            na{" "}
            <Link href={ROTAS_LEGAIS.cookies} className="text-brand-navy underline underline-offset-4">
              Política de Cookies
            </Link>
            .
          </li>
        </ul>
        <p>
          O número do cartão, quando a compra é no cartão, é digitado no
          ambiente do Asaas. A Sensora não guarda esse número. CPF informado
          no perfil serve para a nota fiscal.
        </p>
      </Secao>

      <Secao title="Para quê, e com qual base legal">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Criar a conta, cobrar, entregar e atender o pedido: execução de
            contrato.
          </li>
          <li>
            Emitir e guardar nota fiscal: obrigação legal. Documento fiscal
            fica retido pelo prazo de cinco anos.
          </li>
          <li>
            Cookies essenciais de login, carrinho e checkout: execução de
            contrato. Cookies de medição e marketing: só com consentimento,
            que você pode recusar.
          </li>
          <li>
            Mensagens de novidade, se um dia existirem, só com um aceite
            separado. Comprar ou criar conta não inscreve você em mala direta.
          </li>
        </ul>
      </Secao>

      <Secao title="Com quem compartilhamos">
        <ul className="list-disc space-y-2 pl-5">
          <li>Asaas, para processar o pagamento.</li>
          <li>
            Melhor Envio e a transportadora escolhida, para cotar o frete e
            postar o pedido. Eles recebem o endereço de entrega e os dados
            necessários da encomenda.
          </li>
          <li>
            Provedor de e-mail, para confirmação de conta e recuperação de
            senha.
          </li>
          <li>
            Hospedagem do site. Se você aceitar analytics, a ferramenta dessa
            categoria (quando configurada) pode tratar dados de navegação,
            inclusive fora do Brasil. Sem o seu aceite, esse script não
            carrega.
          </li>
        </ul>
        <p>Não vendemos lista de clientes.</p>
      </Secao>

      <Secao title="Por quanto tempo">
        <p>
          Dados da conta ficam enquanto a conta existir e pelo tempo
          necessário para cumprir obrigação legal ou defender um direito. Dados
          de documento fiscal seguem o prazo de cinco anos. Depois disso, são
          apagados ou anonimizados quando a lei permitir.
        </p>
      </Secao>

      <Secao title="Seus direitos">
        <p>
          Você pode pedir confirmação do tratamento, acesso, correção,
          anonimização, eliminação dos dados desnecessários, informação sobre
          com quem compartilhamos e revogação do consentimento. Correção de
          nome, e-mail, CPF e telefone também está em{" "}
          <Link
            href={ROUTES.CONTA_DADOS_PESSOAIS}
            className="text-brand-navy underline underline-offset-4"
          >
            Minha Conta → Dados pessoais
          </Link>
          .
        </p>
        <p>
          Para exclusão da conta ou qualquer outro pedido, escreva para{" "}
          <a href={mailtoPrivacidade} className="text-brand-navy underline underline-offset-4">
            {EMPRESA.emailSuporte}
          </a>
          . Dados que a lei manda guardar (nota fiscal, por exemplo) não são
          apagados antes do prazo.
        </p>
        <p>
          Este site não é dirigido a criança. Não coletamos dado de menor de
          12 anos de propósito.
        </p>
      </Secao>

      <Secao title="Segurança">
        <p>
          O site usa conexão segura. O pagamento acontece no ambiente do
          Asaas. Nenhum sistema é isento de risco; se houver incidente com
          risco relevante aos titulares, a comunicação segue a LGPD.
        </p>
      </Secao>
    </LegalPage>
  );
}

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

const linkClass = "text-brand-navy underline underline-offset-4";

export default function PoliticaDePrivacidadePage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      intro={`A loja online da ${EMPRESA.nomeFantasia} existe para você comprar velas, sprays e difusores com cadastro, pagamento e entrega. Ao usar o site, alguns dados pessoais passam a ser tratados pela ${EMPRESA.razaoSocial}, na qualidade de controladora, nos termos da Lei Geral de Proteção de Dados (Lei 13.709/2018). Esta política explica quais dados são esses, para quê, com quem e como falar com a gente. Atualizada em ${EMPRESA.atualizadoEm}.`}
    >
      <Secao title="Quem é o controlador">
        <p>
          Sempre que você ler “{EMPRESA.nomeFantasia}”, “nós” ou “nossos”,
          estamos falando do controlador dos seus dados. “Você” e “cliente”
          são o titular.
        </p>
        <IdentificacaoFornecedor />
        <p>
          A empresa é microempresa optante pelo Simples Nacional. O canal do
          titular é {EMPRESA.emailSuporte} — use-o para qualquer pedido sobre
          os seus dados. Não há outro encarregado publicado além desse canal.
        </p>
      </Secao>

      <Secao title="Quais dados pessoais coletamos">
        <p>
          Coletamos o que você informa e o que é necessário para operar a
          compra, o envio e o atendimento:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong>Cadastro:</strong> nome, e-mail, telefone e senha. O CPF é
            informado no checkout (nota fiscal e identificação da entrega) e
            pode ser atualizado depois em Minha Conta.
          </li>
          <li>
            <strong>Compra e entrega:</strong> endereços que você salva,
            snapshot do endereço do pedido, itens, quantidades, frete
            escolhido, valor, status de pagamento e de envio.
          </li>
          <li>
            <strong>Carrinho:</strong> com conta, os produtos e as
            quantidades da sacola ficam no nosso banco, além da cópia no
            seu navegador. Sem login, o carrinho fica só no aparelho.
          </li>
          <li>
            <strong>Pós-venda:</strong> pedidos de reembolso e devolução
            (motivo, descrição, fotos opcionais), chamados de suporte e
            mensagens enviadas aos e-mails da loja.
          </li>
          <li>
            <strong>Navegação:</strong> preferência de cookies no seu
            navegador e o necessário para manter login, carrinho e a volta do
            checkout. O detalhe está na{" "}
            <Link href={ROTAS_LEGAIS.cookies} className={linkClass}>
              Política de Cookies
            </Link>
            .
          </li>
        </ul>
        <p>
          O número do cartão, quando a compra é no cartão, é digitado no
          ambiente do Asaas. A Sensora não guarda esse número. Não pedimos RG
          nem data de nascimento. Este site não é dirigido a criança: não
          coletamos dado de menor de 12 anos de propósito.
        </p>
      </Secao>

      <Secao title="Como utilizamos seus dados">
        <p>Não vendemos nem negociamos lista de clientes. Os dados servem para:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Criar a conta, cobrar, emitir nota, entregar e atender o pedido:
            execução de contrato.
          </li>
          <li>
            Guardar a nota fiscal e cumprir obrigação tributária: obrigação
            legal. Documento fiscal fica retido pelo prazo de cinco anos.
          </li>
          <li>
            Analisar devoluções, reembolsos e chamados de suporte: execução
            de contrato e exercício regular de direito.
          </li>
          <li>
            Cookies essenciais de login, carrinho e checkout: execução de
            contrato. Cookies de medição e marketing: só com consentimento,
            que você pode recusar.
          </li>
          <li>
            Guardar a sacola da conta no nosso banco e enviar um lembrete
            se você deixar itens parados sem finalizar a compra: execução
            de contrato. Não é mala direta de novidade.
          </li>
          <li>
            Enviar um lembrete se você iniciar o pagamento e não concluir:
            execução de contrato. Não é mala direta de novidade.
          </li>
          <li>
            Mensagens transacionais (confirmação de conta, senha, pedido,
            devolução, carrinho não finalizado, pagamento em aberto). Mala
            direta ou e-mail de novidade, se um dia existirem, só com um
            aceite separado. Comprar ou criar conta não inscreve você em
            lista promocional.
          </li>
        </ul>
      </Secao>

      <Secao title="Com quem seus dados podem ser partilhados">
        <p>
          Compartilhamos o mínimo necessário com quem executa a compra em
          nosso nome, ou quando a lei exigir:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Asaas, para processar Pix, cartão e estornos.</li>
          <li>
            Melhor Envio e a transportadora escolhida (em geral os Correios),
            para cotar o frete, postar o pedido e gerar o código de devolução.
            Eles recebem o endereço e os dados da encomenda.
          </li>
          <li>
            ImageKit, para hospedar fotos de produto (públicas) e evidências
            de devolução (arquivo privado, acessível só com link assinado).
          </li>
          <li>
            Provedor de e-mail (Resend ou SMTP configurado), para confirmação
            de conta, recuperação de senha e avisos de pedido, devolução,
            carrinho não finalizado e pagamento em aberto.
          </li>
          <li>
            Hospedagem do site e, se você aceitar analytics, a ferramenta
            dessa categoria (quando configurada). Sem o seu aceite, esse
            script não carrega.
          </li>
          <li>
            Órgãos públicos quando houver obrigação legal ou ordem válida.
          </li>
        </ul>
        <p>
          No checkout, o navegador pode consultar o ViaCEP para completar o
          endereço a partir do CEP. Essa consulta sai do seu aparelho para o
          serviço público de CEP.
        </p>
      </Secao>

      <Secao title="Armazenamento e segurança">
        <p>
          O site usa conexão segura. Senha e tokens de redefinição ou
          confirmação são guardados só como hash, nunca em texto puro. O
          pagamento acontece no ambiente do Asaas. Fotos de devolução não
          ficam públicas. O carrinho da conta fica no nosso banco enquanto
          houver itens na sacola.
        </p>
        <p>
          Nenhum sistema é isento de risco. Se houver incidente com risco
          relevante aos titulares, a comunicação segue a LGPD.
        </p>
      </Secao>

      <Secao title="Retenção e exclusão dos dados">
        <p>
          Dados da conta ficam enquanto a conta existir e pelo tempo
          necessário para cumprir obrigação legal ou defender um direito.
          Dados de documento fiscal seguem o prazo de cinco anos. Depois
          disso, são apagados ou anonimizados quando a lei permitir. Itens
          do carrinho da conta são apagados quando você esvazia a sacola ou
          quando o pagamento é confirmado.
        </p>
        <p>
          Se você pedir a exclusão da conta, podemos reter o que a lei manda
          guardar (nota fiscal, por exemplo) pelo prazo legal, sem usar esses
          dados para marketing.
        </p>
      </Secao>

      <Secao title="O que são cookies e como os utilizamos">
        <p>
          Cookies e o armazenamento local do navegador reconhecem sua sessão,
          uma cópia do carrinho e a volta do checkout. Com conta, a sacola
          também fica no nosso banco. Essenciais funcionam sem
          consentimento porque a loja não opera sem eles. Medição e marketing
          só depois do aceite no aviso do site, que você pode mudar em
          Preferências de cookies no rodapé. A lista do que existe hoje está
          na{" "}
          <Link href={ROTAS_LEGAIS.cookies} className={linkClass}>
            Política de Cookies
          </Link>
          .
        </p>
      </Secao>

      <Secao title="Transferência internacional de dados">
        <p>
          Alguns prestadores podem processar dados fora do Brasil — por
          exemplo ImageKit (arquivos), o provedor de e-mail e, se você
          aceitar, a ferramenta de analytics. Nesses casos seguimos a LGPD e
          usamos o prestador só para a finalidade descrita aqui.
        </p>
      </Secao>

      <Secao title="Seus direitos como titular">
        <p>Você pode pedir, de forma gratuita:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>confirmação de que tratamos os seus dados e acesso a eles;</li>
          <li>correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>
            anonimização, bloqueio ou eliminação dos dados desnecessários,
            excessivos ou tratados em desconformidade com a LGPD;
          </li>
          <li>informação sobre com quem compartilhamos;</li>
          <li>
            informação sobre a possibilidade de não dar consentimento e as
            consequências disso, quando o tratamento depender de
            consentimento;
          </li>
          <li>revogação do consentimento.</li>
        </ul>
        <p>
          Correção de nome, e-mail, CPF e telefone também está em{" "}
          <Link href={ROUTES.CONTA_DADOS_PESSOAIS} className={linkClass}>
            Minha Conta → Dados pessoais
          </Link>
          . Pedidos serão avaliados quanto à identidade e à viabilidade,
          porque algumas obrigações (nota fiscal, por exemplo) impedem o
          apagamento imediato.
        </p>
        <p>
          Para exclusão da conta ou qualquer outro pedido, escreva para{" "}
          <a href={mailtoPrivacidade} className={linkClass}>
            {EMPRESA.emailSuporte}
          </a>
          .
        </p>
      </Secao>

      <Secao title="Alterações desta política">
        <p>
          Podemos atualizar esta página para refletir mudanças na loja ou na
          lei. A versão vigente é a publicada aqui, com a data no início.
          Mudança relevante de cookies opcionais faz o aviso do site
          reaparecer.
        </p>
      </Secao>

      <Secao title="Fale conosco">
        <p>
          Dúvida sobre esta política ou pedido de titular:{" "}
          <a href={mailtoPrivacidade} className={linkClass}>
            {EMPRESA.emailSuporte}
          </a>
          . Identificação da empresa e endereço estão também em{" "}
          <Link href={ROTAS_LEGAIS.quemSomos} className={linkClass}>
            Quem somos
          </Link>
          .
        </p>
      </Secao>
    </LegalPage>
  );
}

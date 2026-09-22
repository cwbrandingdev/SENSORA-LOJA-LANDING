import type { Metadata } from "next";
import Link from "next/link";
import IdentificacaoFornecedor from "@/components/legal/IdentificacaoFornecedor";
import { LegalPage, Secao } from "@/components/legal/LegalDocument";
import { ABOUT_CONTENT } from "@/lib/content";
import { EMPRESA, ROTAS_LEGAIS } from "@/lib/empresa";

export const metadata: Metadata = {
  title: "Quem somos",
  description:
    "A Sensora é a marca de marketing sensorial da Cazarim & Souza Ltda. Razão social, CNPJ e endereço da loja.",
};

export default function QuemSomosPage() {
  return (
    <LegalPage
      title="Quem somos"
      intro="Velas, sprays e difusores para perfumar a casa — e os dados de quem vende, no mesmo lugar."
    >
      <Secao title="A Sensora">
        {ABOUT_CONTENT.paragraphs.map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
        <p>
          A marca Sensora é operada por {EMPRESA.razaoSocial}. Os produtos
          perfumam o ambiente. Não prometem efeito terapêutico, medicinal ou
          de desinfecção.
        </p>
      </Secao>

      <Secao title="Dados da empresa">
        <IdentificacaoFornecedor />
        <p>
          Instagram:{" "}
          <a
            href={EMPRESA.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-navy underline underline-offset-4"
          >
            {EMPRESA.instagram}
          </a>
        </p>
      </Secao>

      <Secao title="Documentos da loja">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <Link href={ROTAS_LEGAIS.termos} className="text-brand-navy underline underline-offset-4">
              Termos de Uso
            </Link>
          </li>
          <li>
            <Link
              href={ROTAS_LEGAIS.privacidade}
              className="text-brand-navy underline underline-offset-4"
            >
              Política de Privacidade
            </Link>
          </li>
          <li>
            <Link href={ROTAS_LEGAIS.trocas} className="text-brand-navy underline underline-offset-4">
              Trocas, devoluções e arrependimento
            </Link>
          </li>
          <li>
            <Link href={ROTAS_LEGAIS.cookies} className="text-brand-navy underline underline-offset-4">
              Política de Cookies
            </Link>
          </li>
        </ul>
      </Secao>
    </LegalPage>
  );
}

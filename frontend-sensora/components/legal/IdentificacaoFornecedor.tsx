import { EMPRESA, ENDERECO_LINHA } from "@/lib/empresa";

export default function IdentificacaoFornecedor({
  className = "",
}: {
  className?: string;
}) {
  return (
    <address className={`not-italic ${className}`}>
      <p>{EMPRESA.razaoSocial}</p>
      <p>CNPJ {EMPRESA.cnpj}</p>
      <p>{ENDERECO_LINHA}</p>
      <p>
        <a
          href={`mailto:${EMPRESA.email}`}
          className="text-inherit underline underline-offset-2"
        >
          {EMPRESA.email}
        </a>
      </p>
    </address>
  );
}

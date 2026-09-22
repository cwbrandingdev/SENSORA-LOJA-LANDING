import Link from "next/link";
import { EMPRESA, ROTAS_LEGAIS } from "@/lib/empresa";

export default function AvisosProduto({
  categoriaSlug,
  categoriaNome,
  quantidade,
}: {
  categoriaSlug?: string | null;
  categoriaNome?: string | null;
  quantidade: number;
}) {
  const texto = `${categoriaSlug ?? ""} ${categoriaNome ?? ""}`.toLowerCase();
  const vela = texto.includes("vela");
  const spray = texto.includes("spray");
  const difusor = texto.includes("difusor");

  return (
    <div className="mt-10 max-w-md space-y-4 border-t border-slate-200 pt-8 text-sm leading-relaxed text-slate-600">
      <p className="text-brand-navy">
        {quantidade > 0 ? "Disponível para entrega." : "Esgotado no momento."}{" "}
        Vendido por {EMPRESA.razaoSocial}, {EMPRESA.cidade}/{EMPRESA.uf}. O
        valor e o prazo do frete aparecem no checkout, antes do pagamento.
      </p>

      <div>
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-navy">
          Uso e riscos
        </h2>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>Não ingerir. Manter fora do alcance de crianças e animais.</li>
          <li>
            Perfumam o ambiente. Não têm efeito terapêutico, medicinal ou de
            desinfecção.
          </li>
          {vela && (
            <li>
              Não deixe a vela acesa sem supervisão. Use superfície estável e
              resistente ao calor, longe de cortinas, corrente de ar e
              material inflamável. Apague antes de o produto acabar.
            </li>
          )}
          {spray && (
            <li>
              Não pulverize no rosto, nos olhos, na pele ou em alimentos, nem
              perto de chama ou fonte de calor.
            </li>
          )}
          {difusor && (
            <li>
              O líquido do difusor não é para a pele nem para ingestão.
              Mantenha o frasco e as varetas longe de chama.
            </li>
          )}
          {!vela && !spray && !difusor && (
            <li>
              Siga a embalagem. Mantenha o produto longe de chama, de crianças
              e de animais.
            </li>
          )}
        </ul>
      </div>

      <p>
        Você pode desistir em 7 dias após o recebimento. Defeito tem garantia
        legal de 30 dias.{" "}
        <Link href={ROTAS_LEGAIS.trocas} className="text-brand-navy underline underline-offset-4">
          Trocas e devoluções
        </Link>
        .
      </p>
    </div>
  );
}

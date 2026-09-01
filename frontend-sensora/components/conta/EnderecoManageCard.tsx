// Etapa 4 (Minha Conta / Endereços) — card de GESTÃO (Editar/Excluir/Tornar
// padrão), diferente de components/loja/EnderecoCard.tsx (botão de SELEÇÃO
// usado no checkout, semântica de radio) — propositalmente um componente
// separado, não uma variante do card de seleção.
import FormButton from "@/components/ui/FormButton";
import type { Endereco } from "@/lib/types/loja";

type EnderecoManageCardProps = {
  endereco: Endereco;
  onEditar: () => void;
  onExcluir: () => void;
  onTornarPadrao: () => void;
  processando?: boolean;
};

export default function EnderecoManageCard({
  endereco,
  onEditar,
  onExcluir,
  onTornarPadrao,
  processando = false,
}: EnderecoManageCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-sm border border-slate-200 bg-white p-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-brand-navy">
            {endereco.rua}, {endereco.numero}
            {endereco.complemento ? ` — ${endereco.complemento}` : ""}
          </p>
          {endereco.padrao && (
            <span className="inline-flex items-center rounded-full bg-brand-orange/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">
              Padrão
            </span>
          )}
        </div>
        <p className="mt-1 text-slate-500">
          {endereco.bairro} — {endereco.cidade}/{endereco.estado}
        </p>
        <p className="text-slate-500">CEP {endereco.cep}</p>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2">
        {!endereco.padrao && (
          <FormButton
            type="button"
            variant="ghost"
            onClick={onTornarPadrao}
            disabled={processando}
          >
            Tornar padrão
          </FormButton>
        )}
        <FormButton type="button" variant="secondary" onClick={onEditar} disabled={processando}>
          Editar
        </FormButton>
        <FormButton type="button" variant="danger" onClick={onExcluir} disabled={processando}>
          Excluir
        </FormButton>
      </div>
    </div>
  );
}

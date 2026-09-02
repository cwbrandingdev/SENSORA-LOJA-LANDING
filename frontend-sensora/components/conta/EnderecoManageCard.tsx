// Etapa 4 (Minha Conta / Endereços) — card de GESTÃO (Editar/Excluir/Tornar
// padrão), diferente de components/loja/EnderecoCard.tsx (botão de SELEÇÃO
// usado no checkout, semântica de radio) — propositalmente um componente
// separado, não uma variante do card de seleção.
import { MapPin } from "lucide-react";
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
    // Etapa 6.1 (Refinamento) — o endereço padrão ganha hierarquia visual
    // própria (borda em brand-orange/30 + leve tingimento de fundo), não só
    // o badge "Padrão": item 14 da etapa pede uma distinção clara entre
    // padrão e os demais, não só textual.
    <div
      className={`flex flex-col gap-4 rounded-sm border p-6 transition-colors duration-300 sm:flex-row sm:items-start sm:justify-between ${
        endereco.padrao
          ? "border-brand-orange/30 bg-brand-orange/[0.03]"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex min-w-0 gap-3 text-sm">
        <span
          aria-hidden
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            endereco.padrao ? "bg-brand-orange/10 text-brand-orange" : "bg-slate-100 text-slate-500"
          }`}
        >
          <MapPin className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-brand-navy">
              {endereco.rua}, {endereco.numero}
              {endereco.complemento ? ` — ${endereco.complemento}` : ""}
            </p>
            {endereco.padrao && (
              <span className="inline-flex items-center rounded-full bg-brand-orange/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-orange">
                Endereço padrão
              </span>
            )}
          </div>
          <p className="mt-1 text-slate-500">
            {endereco.bairro} — {endereco.cidade}/{endereco.estado}
          </p>
          <p className="text-slate-500">CEP {endereco.cep}</p>
        </div>
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

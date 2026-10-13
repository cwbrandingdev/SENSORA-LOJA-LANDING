// Status de uma solicitação de suporte no Workspace-X (lista e detalhe).
import Badge, { type BadgeTone } from "@/components/ui/Badge";
import {
  ROTULOS_STATUS_SUPORTE,
  type StatusSolicitacaoSuporte,
} from "@/lib/types/loja";

const TOM_STATUS_SUPORTE: Record<StatusSolicitacaoSuporte, BadgeTone> = {
  ABERTA: "warning",
  EM_ATENDIMENTO: "info",
  RESOLVIDA: "success",
};

export default function StatusSuporteBadge({ status }: { status: StatusSolicitacaoSuporte }) {
  return (
    <Badge tone={TOM_STATUS_SUPORTE[status] ?? "neutral"}>
      {ROTULOS_STATUS_SUPORTE[status] ?? status}
    </Badge>
  );
}

// Data e hora de São Paulo (criadaEm é o instante real da abertura).
export function formatarDataSuporte(data: string): string {
  return new Date(data).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
}

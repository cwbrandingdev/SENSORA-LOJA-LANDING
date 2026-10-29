import { IsEnum } from 'class-validator';
import type { AlertaTipo } from '../entities/alerta.entity';

export class ExcluirAlertaDto {
  @IsEnum(
    [
      'ESTOQUE_BAIXO',
      'REEMBOLSO_SOLICITADO',
      'PEDIDO_AGUARDANDO_ENVIO',
      'MELHOR_ENVIO_DESCONECTADO',
      'DEVOLUCAO_SOLICITADA',
      'PEDIDO_NOVO',
      'SUPORTE_ABERTO',
      'AVALIACAO_PENDENTE',
    ] satisfies AlertaTipo[],
    { message: 'tipo de alerta inválido' },
  )
  tipo: AlertaTipo;
}

import { IsOptional, IsString, MaxLength } from 'class-validator';

// Body opcional de POST /pedidos/:id/marcar-enviado. Sem este campo a
// transição NAO_ENVIADO -> ENVIADO continua igual à Etapa 6.6; com ele, o
// código é gravado no snapshot do pedido para o cliente acompanhar.
export class MarcarEnviadoDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  codigoRastreio?: string;
}

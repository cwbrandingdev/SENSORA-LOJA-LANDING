import { IsInt, IsNumber, IsPositive } from 'class-validator';

// Corpo de POST /admin/devolucoes/:id/logistica. Do cliente HTTP vêm só o
// serviço escolhido e o custo que o ADMIN viu e confirmou (teto da compra):
// transportadora, nome e preço reais são sempre lidos do Melhor Envio.
export class GerarLogisticaDto {
  @IsInt()
  @IsPositive()
  servicoId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  custoConfirmado: number;
}

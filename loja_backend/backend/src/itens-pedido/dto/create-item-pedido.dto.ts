import { IsInt, IsNumber, IsPositive, Min } from 'class-validator';

export class CreateItemPedidoDto {
  @IsInt()
  @IsPositive()
  pedidoId: number;

  @IsInt()
  @IsPositive()
  produtoId: number;

  @IsInt()
  @Min(1)
  quantidade: number;

  @IsNumber()
  @Min(0)
  precoUnitario: number;
}

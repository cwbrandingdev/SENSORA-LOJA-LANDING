import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ItemConferidoDto {
  @IsInt()
  @IsPositive()
  itemPedidoId: number;

  @IsInt()
  @Min(0)
  quantidadeAceita: number;
}

// Corpo de POST /admin/devolucoes/:id/concluir. Do cliente HTTP vêm só as
// quantidades aceitas na conferência física e a observação: preço, valor do
// reembolso e limites são sempre calculados no backend.
export class ConcluirConferenciaDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemConferidoDto)
  itens: ItemConferidoDto[];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observacao?: string;
}

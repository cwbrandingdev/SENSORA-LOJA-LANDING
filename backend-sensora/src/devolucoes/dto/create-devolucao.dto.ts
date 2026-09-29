import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// O cliente informa só o item do pedido e a quantidade — nunca preço,
// usuário ou status (a ValidationPipe global rejeita qualquer campo que não
// esteja declarado aqui, ver main.ts: whitelist + forbidNonWhitelisted).
export class ItemDevolucaoDto {
  @IsInt()
  @IsPositive()
  itemPedidoId: number;

  @IsInt()
  @Min(1)
  quantidade: number;
}

export class CreateDevolucaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  motivo: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descricao?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ItemDevolucaoDto)
  itens: ItemDevolucaoDto[];
}

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsPositive,
  Min,
  ValidateNested,
} from 'class-validator';

export class ItemCarrinhoDto {
  @IsInt()
  @IsPositive()
  produtoId: number;

  @IsInt()
  @Min(1)
  quantidade: number;
}

// Substitui a sacola inteira da conta autenticada. `usuarioId` nunca vem
// do body — sempre do JWT (CarrinhoController). Produto inexistente ou
// inativo é ignorado no service, para um item descontinuado no localStorage
// não impedir o restante de gravar.
export class SalvarCarrinhoDto {
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ItemCarrinhoDto)
  itens: ItemCarrinhoDto[];
}

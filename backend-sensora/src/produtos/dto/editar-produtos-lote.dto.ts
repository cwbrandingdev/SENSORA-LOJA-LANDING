import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  Min,
  ValidateNested,
} from 'class-validator';

// Uma linha da edição em lote: o produto e só os campos que mudam.
export class AlteracaoProdutoDto {
  @IsInt()
  id: number;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  preco?: number;

  // "Definir" o estoque: vira exatamente este número.
  @IsOptional()
  @IsInt()
  @Min(0)
  quantidade?: number;

  // "Somar" ao estoque atual (reposição). A soma é feita no banco, então
  // não apaga uma venda que aconteça enquanto alguém está editando.
  @IsOptional()
  @IsInt()
  @Min(1)
  somarEstoque?: number;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class EditarProdutosLoteDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AlteracaoProdutoDto)
  alteracoes: AlteracaoProdutoDto[];
}

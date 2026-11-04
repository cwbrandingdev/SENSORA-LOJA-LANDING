import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsString,
  Matches,
} from 'class-validator';

// Ids no mesmo formato da lista "Para acompanhar":
// "carrinho-<usuarioId>" ou "checkout-<pedidoId>".

export class DispensarAcompanhamentoDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @Matches(/^(carrinho|checkout)-\d+$/, { each: true })
  ids: string[];
}

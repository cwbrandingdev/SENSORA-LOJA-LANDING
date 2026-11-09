import { IsInt, IsPositive, Matches } from 'class-validator';

// Payload de POST /checkout/frete/produto: prévia do frete na página do
// produto, sem login. O CEP chega só com números (o frontend tira o hífen).
export class CotarFreteProdutoDto {
  @IsInt()
  @IsPositive()
  produtoId: number;

  @Matches(/^\d{8}$/, { message: 'CEP inválido' })
  cep: string;
}

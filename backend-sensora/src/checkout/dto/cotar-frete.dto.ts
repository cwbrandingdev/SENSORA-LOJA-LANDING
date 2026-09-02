import { IsArray, IsInt, IsPositive, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CheckoutItemDto } from './create-checkout-session.dto';

// Etapa 6.5 (Frete) — payload de POST /checkout/frete/cotacao. Mesmo
// CheckoutItemDto do checkout (produtoId+quantidade, nunca preço/peso do
// frontend) porque o carrinho não existe no backend (é estado só do
// frontend, ver CartContext) — o backend sempre recarrega os produtos reais
// a partir destes ids, igual a CreateCheckoutSessionDto.
export class CotarFreteDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  itens: CheckoutItemDto[];

  @IsInt()
  @IsPositive()
  enderecoId: number;
}

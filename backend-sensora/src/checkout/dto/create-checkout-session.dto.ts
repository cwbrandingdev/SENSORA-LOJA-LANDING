import {
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsPositive,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CheckoutItemDto {
  @IsInt()
  @IsPositive()
  produtoId: number;

  @IsInt()
  @Min(1)
  quantidade: number;
}

export class CreateCheckoutSessionDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  itens: CheckoutItemDto[];

  @IsEmail()
  @IsNotEmpty()
  clienteEmail: string;

  @IsString()
  @IsNotEmpty()
  clienteNome: string;

  @IsInt()
  @IsPositive()
  enderecoId: number;

  // Etapa 6.5 (Frete) — só o id do serviço escolhido na cotação (ver POST
  // /checkout/frete/cotacao), NUNCA o preço/prazo/transportadora: o backend
  // recotiza e valida esta opção contra o Melhor Envio antes de aceitar o
  // pedido (CheckoutService.createSession), exatamente como já faz com
  // preço/estoque de produto — o cliente nunca consegue manipular o valor
  // do frete só porque enviou um número diferente aqui.
  @IsInt()
  @IsPositive()
  freteServicoId: number;
}

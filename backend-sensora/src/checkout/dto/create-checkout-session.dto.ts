import {
  IsArray,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsPositive,
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

  // Etapa "Dados do Cliente / Cadastro" (achado da auditoria) — `clienteNome`
  // foi removido deste DTO de propósito: o nome do pedido nunca mais vem do
  // frontend (antes, a Loja mandava a parte local do e-mail como "nome
  // provisório" — ver histórico do arquivo). CheckoutService.createSession
  // agora usa Usuario.nome (já buscado ali mesmo, para a checagem de
  // e-mail confirmado), o mesmo princípio já aplicado a preço/estoque/frete:
  // nunca confiar em dado do cliente quando o backend já tem a fonte real.
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

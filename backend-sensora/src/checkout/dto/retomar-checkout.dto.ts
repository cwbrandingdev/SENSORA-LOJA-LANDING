import { IsInt, IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

// POST /checkout/pendente — retoma o pagamento de um Pedido já criado
// (PENDENTE), sem abrir um pedido novo. Sem `pedidoId`, usa o PENDENTE mais
// recente do usuário autenticado (banner do carrinho). Com `pedidoId`,
// retoma aquele pedido específico (botão em Minha Conta), desde que seja
// dele e ainda esteja PENDENTE — ownership nunca vem do cliente, só do token.
export class RetomarCheckoutDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  pedidoId?: number;
}

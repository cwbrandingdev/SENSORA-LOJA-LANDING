import { IsInt, IsPositive, Min } from 'class-validator';

// Achado da auditoria (HIGH-01): `precoUnitario` foi removido deste DTO de
// propósito — um item de pedido nunca pode carregar um preço inventado pelo
// cliente. ItensPedidoService.create()/update() sempre derivam o preço do
// Produto real (mesma fonte de verdade que CheckoutService.createSession já
// usa: `ProdutosService.findOne(produtoId).preco`), nunca de um valor
// enviado no corpo da requisição.
export class CreateItemPedidoDto {
  @IsInt()
  @IsPositive()
  pedidoId: number;

  @IsInt()
  @IsPositive()
  produtoId: number;

  @IsInt()
  @Min(1)
  quantidade: number;
}

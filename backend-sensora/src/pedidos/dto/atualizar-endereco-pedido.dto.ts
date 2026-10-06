import { IsInt, IsPositive } from 'class-validator';

// Body de PATCH /pedidos/meus/:id/endereco — só o id de um Endereco já
// salvo na conta. O backend copia o snapshot e recusa CEP diferente do
// frete já pago; nunca aceita rua/CEP soltos vindos do cliente.
export class AtualizarEnderecoPedidoDto {
  @IsInt()
  @IsPositive()
  enderecoId: number;
}

import { IsDateString, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

// Achado da auditoria (HIGH-01): `status` foi removido deste DTO de
// propósito — não existe venda manual no sistema, então o cliente (mesmo
// STAFF_ROLES) nunca pode escolher o estado financeiro de um pedido na
// criação. PedidosService.create() sempre grava PENDENTE. Como
// UpdatePedidoDto é PartialType(CreatePedidoDto), a remoção também fecha
// PUT /pedidos/:id para este campo (reforçado ainda por
// PedidosService.update(), que só repassa numero/data/total ao Prisma,
// nunca um spread genérico do DTO).
export class CreatePedidoDto {
  @IsString()
  @IsNotEmpty()
  numero: string;

  @IsDateString()
  data: string;

  @IsNumber()
  @Min(0)
  total: number;
}

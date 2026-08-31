import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { StatusPedido } from '../enums/status-pedido.enum';

export class CreatePedidoDto {
  @IsString()
  @IsNotEmpty()
  numero: string;

  @IsDateString()
  data: string;

  @IsEnum(StatusPedido)
  @IsOptional()
  status?: StatusPedido;

  @IsNumber()
  @Min(0)
  total: number;
}

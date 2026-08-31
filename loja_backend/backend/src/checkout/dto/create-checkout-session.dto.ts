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
}

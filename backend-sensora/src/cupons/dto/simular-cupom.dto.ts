import { Transform, Type } from 'class-transformer';
import { IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class SimularCupomDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(20)
  codigo: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal: number;
}

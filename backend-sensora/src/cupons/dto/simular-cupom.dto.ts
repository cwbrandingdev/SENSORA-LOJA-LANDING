import { Transform } from 'class-transformer';
import { IsNumber, IsString, MaxLength, Min } from 'class-validator';

export class SimularCupomDto {
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @MaxLength(20)
  codigo: string;

  // 19,90 × 3 em JavaScript é 59.699999999999996. Sem arredondar antes,
  // @IsNumber({ maxDecimalPlaces: 2 }) recusa o cupom.
  @Transform(({ value }) => {
    const numero = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(numero)) {
      return value;
    }
    return Math.round(numero * 100) / 100;
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  subtotal: number;
}

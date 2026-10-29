import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { SimularCupomDto } from './simular-cupom.dto';

const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});

function validar(body: unknown) {
  return pipe.transform(body, { type: 'body', metatype: SimularCupomDto });
}

describe('SimularCupomDto', () => {
  it('aceita o subtotal com ruído de ponto flutuante e arredonda para centavos', async () => {
    const dto = await validar({
      codigo: 'bemvindo10',
      subtotal: 19.9 * 3,
    });

    expect(dto).toBeInstanceOf(SimularCupomDto);
    expect(dto.codigo).toBe('BEMVINDO10');
    expect(dto.subtotal).toBe(59.7);
  });

  it('recusa um subtotal que não é número', async () => {
    await expect(
      validar({ codigo: 'BEMVINDO10', subtotal: 'abc' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

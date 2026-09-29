import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateDevolucaoDto } from './create-devolucao.dto';

// Usa a MESMA configuração da ValidationPipe global (ver main.ts), para
// testar o que realmente chega ao service numa requisição HTTP.
const pipe = new ValidationPipe({
  whitelist: true,
  transform: true,
  forbidNonWhitelisted: true,
});

function validar(body: unknown) {
  return pipe.transform(body, { type: 'body', metatype: CreateDevolucaoDto });
}

const corpoValido = {
  motivo: 'Chegou quebrada',
  descricao: 'Tampa rachada',
  itens: [{ itemPedidoId: 100, quantidade: 1 }],
};

// Cópia do corpo válido sem um dos campos.
function sem(campo: keyof typeof corpoValido): Record<string, unknown> {
  const copia: Record<string, unknown> = { ...corpoValido };
  delete copia[campo];
  return copia;
}

describe('CreateDevolucaoDto (ValidationPipe global)', () => {
  it('aceita um corpo válido (descrição opcional)', async () => {
    await expect(validar(corpoValido)).resolves.toBeInstanceOf(
      CreateDevolucaoDto,
    );
    await expect(validar(sem('descricao'))).resolves.toBeDefined();
  });

  it.each([
    ['quantidade zero', 0],
    ['quantidade negativa', -1],
    ['quantidade decimal', 1.5],
    ['quantidade como texto', '1'],
  ])('rejeita %s', async (_caso, quantidade) => {
    await expect(
      validar({ ...corpoValido, itens: [{ itemPedidoId: 100, quantidade }] }),
    ).rejects.toThrow(BadRequestException);
  });

  it.each([
    ['itemPedidoId ausente', { quantidade: 1 }],
    ['itemPedidoId zero', { itemPedidoId: 0, quantidade: 1 }],
    ['itemPedidoId decimal', { itemPedidoId: 1.5, quantidade: 1 }],
  ])('rejeita %s', async (_caso, item) => {
    await expect(validar({ ...corpoValido, itens: [item] })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejeita motivo ausente', async () => {
    await expect(validar(sem('motivo'))).rejects.toThrow(BadRequestException);
  });

  it('rejeita motivo vazio e motivo que não é texto', async () => {
    await expect(validar({ ...corpoValido, motivo: '' })).rejects.toThrow(
      BadRequestException,
    );
    await expect(validar({ ...corpoValido, motivo: 123 })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejeita motivo e descrição longos demais', async () => {
    await expect(
      validar({ ...corpoValido, motivo: 'a'.repeat(201) }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      validar({ ...corpoValido, descricao: 'a'.repeat(2001) }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejeita itens ausentes ou lista vazia', async () => {
    await expect(validar(sem('itens'))).rejects.toThrow(BadRequestException);
    await expect(validar({ ...corpoValido, itens: [] })).rejects.toThrow(
      BadRequestException,
    );
  });

  it.each([
    ['usuarioId', { usuarioId: 999 }],
    ['status', { status: 'CONCLUIDA' }],
    ['pedidoId', { pedidoId: 1 }],
  ])('rejeita %s manipulado no corpo', async (_campo, extra) => {
    await expect(validar({ ...corpoValido, ...extra })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejeita preço enviado no item', async () => {
    await expect(
      validar({
        ...corpoValido,
        itens: [{ itemPedidoId: 100, quantidade: 1, precoUnitario: 0.01 }],
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

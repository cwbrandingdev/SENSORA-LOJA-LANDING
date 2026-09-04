import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ClientesService } from './clientes.service';

// Etapa 8.10 (hardening LOW — achado da auditoria) — Cliente é o módulo
// legado (desconectado do fluxo real de pedidos da loja, que usa
// Usuario.cpf/telefone, já validados — ver checkout.service.ts). Antes
// desta etapa, create()/update() aqui aceitavam qualquer string não-vazia
// como CPF ou telefone. Prova que a mesma validação já usada e testada em
// UsuariosService (cpf.util/telefone.util) agora também se aplica aqui,
// sem duplicar a lógica nem inventar uma regra nova.

describe('ClientesService — validação de CPF/telefone (Etapa 8.10)', () => {
  let service: ClientesService;
  let prisma: {
    cliente: {
      create: jest.Mock;
      update: jest.Mock;
      findUnique: jest.Mock;
    };
  };

  const clienteBase = {
    nome: 'Cliente Teste',
    email: 'cliente@sensora.dev',
    endereco: 'Rua Teste, 123',
  };

  beforeEach(async () => {
    prisma = {
      cliente: {
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
          id: 1,
          ...data,
        })),
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
          id: 1,
          ...clienteBase,
          cpf: '52998224725',
          telefone: '41999999999',
          ...data,
        })),
        findUnique: jest.fn(() => ({
          id: 1,
          ...clienteBase,
          cpf: '52998224725',
          telefone: '41999999999',
        })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [ClientesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ClientesService);
  });

  it('create(): CPF válido é normalizado (só dígitos) antes de persistir', async () => {
    const resultado = await service.create({
      ...clienteBase,
      cpf: '529.982.247-25',
      telefone: '(41) 99999-9999',
    });

    expect(resultado.cpf).toBe('52998224725');
    expect(resultado.telefone).toBe('41999999999');
    expect(prisma.cliente.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cpf: '52998224725',
        telefone: '41999999999',
      }),
    });
  });

  it('create(): CPF inválido (dígito verificador incorreto) é rejeitado, nunca chega ao Prisma', async () => {
    await expect(
      service.create({ ...clienteBase, cpf: '123.456.789-00', telefone: '41999999999' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.cliente.create).not.toHaveBeenCalled();
  });

  it('create(): CPF com todos os dígitos iguais (ex.: 111.111.111-11) é rejeitado', async () => {
    await expect(
      service.create({ ...clienteBase, cpf: '11111111111', telefone: '41999999999' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('create(): telefone com quantidade de dígitos inválida é rejeitado, nunca chega ao Prisma', async () => {
    await expect(
      service.create({ ...clienteBase, cpf: '52998224725', telefone: '123456' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.cliente.create).not.toHaveBeenCalled();
  });

  it('update(): CPF/telefone continuam validados quando enviados', async () => {
    await expect(
      service.update(1, { cpf: '123.456.789-00' }),
    ).rejects.toThrow(BadRequestException);
    expect(prisma.cliente.update).not.toHaveBeenCalled();
  });

  it('update(): sem cpf/telefone no payload, nenhuma validação extra é disparada (edição parcial legítima)', async () => {
    const resultado = await service.update(1, { nome: 'Novo Nome' });

    expect(resultado.nome).toBe('Novo Nome');
    expect(prisma.cliente.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { nome: 'Novo Nome' },
    });
  });
});

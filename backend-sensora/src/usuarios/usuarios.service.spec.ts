import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario } from './enums/perfil-usuario.enum';
import { UsuariosService } from './usuarios.service';

// Etapa 6.4 (Confirmação de e-mail) — cobre especificamente o parâmetro novo
// de create() (opcoes.emailVerificado). Não duplica a suíte de
// checkout.service.spec.ts nem testa bcrypt/Prisma em si — só prova que o
// campo é omitido do `data` (deixando o @default(true) do schema decidir)
// quando ninguém pede o contrário, e gravado explicitamente quando pedido.
describe('UsuariosService — create (Etapa 6.4: estado inicial de emailVerificado)', () => {
  let service: UsuariosService;
  let prismaCreate: jest.Mock;

  beforeEach(async () => {
    prismaCreate = jest.fn(({ data }: { data: Record<string, unknown> }) => ({
      id: 1,
      ...data,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: { usuario: { create: prismaCreate } } },
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  // N
  it('N: criação administrativa (sem a opção emailVerificado) não grava o campo — deixa o @default(true) do schema decidir, então ADMIN/VENDEDOR criados pelo painel nascem verificados sem código especial', async () => {
    await service.create({
      nome: 'Equipe Sensora',
      email: 'equipe@sensora.dev',
      senha: 'senhaSegura123',
      perfil: PerfilUsuario.VENDEDOR,
    });

    expect(prismaCreate).toHaveBeenCalledTimes(1);
    const dataEnviada = prismaCreate.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(dataEnviada).not.toHaveProperty('emailVerificado');
  });

  it('cadastro público (opções.emailVerificado: false, usado por AuthService.register) grava o valor pedido explicitamente', async () => {
    await service.create(
      {
        nome: 'Cliente Sensora',
        email: 'cliente@sensora.dev',
        senha: 'senhaSegura123',
        perfil: PerfilUsuario.CLIENTE,
      },
      { emailVerificado: false },
    );

    expect(prismaCreate).toHaveBeenCalledTimes(1);
    const dataEnviada = prismaCreate.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(dataEnviada).toHaveProperty('emailVerificado', false);
  });

  it('opções.emailVerificado: true grava o valor explicitamente (mesmo já sendo o default)', async () => {
    await service.create(
      {
        nome: 'Cliente Sensora',
        email: 'cliente2@sensora.dev',
        senha: 'senhaSegura123',
        perfil: PerfilUsuario.CLIENTE,
      },
      { emailVerificado: true },
    );

    const dataEnviada = prismaCreate.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(dataEnviada).toHaveProperty('emailVerificado', true);
  });
});

// Etapa "Dados do Cliente / Cadastro" — CPF/telefone via self-service
// (PUT /usuarios/me). Banco em memória (Map por id), mesmo raciocínio de
// pedidoFake em pedidos.service.spec.ts: findUnique/update simulados o
// suficiente para exercitar as checagens reais do service (duplicidade de
// e-mail/CPF, normalização, validação), sem banco real.
describe('UsuariosService — atualizarMeusDados: CPF/telefone', () => {
  let service: UsuariosService;
  let usuariosFake: Map<number, Record<string, unknown>>;
  let findUnique: jest.Mock;
  let update: jest.Mock;

  function usuarioBase(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 1,
      nome: 'Cliente Um',
      email: 'um@sensora.dev',
      perfil: PerfilUsuario.CLIENTE,
      ativo: true,
      emailVerificado: true,
      cpf: null,
      telefone: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    usuariosFake = new Map([
      [1, usuarioBase()],
      [
        2,
        usuarioBase({
          id: 2,
          nome: 'Cliente Dois',
          email: 'dois@sensora.dev',
          cpf: '11144477735',
        }),
      ],
    ]);

    findUnique = jest.fn(
      ({ where }: { where: { id?: number; email?: string; cpf?: string } }) => {
        if (where.id !== undefined) return usuariosFake.get(where.id) ?? null;
        if (where.email !== undefined) {
          return (
            [...usuariosFake.values()].find((u) => u.email === where.email) ??
            null
          );
        }
        if (where.cpf !== undefined) {
          return (
            [...usuariosFake.values()].find((u) => u.cpf === where.cpf) ?? null
          );
        }
        return null;
      },
    );

    update = jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: number };
        data: Record<string, unknown>;
      }) => {
        const atual = usuariosFake.get(where.id)!;
        const atualizado = { ...atual, ...data };
        usuariosFake.set(where.id, atualizado);
        return atualizado;
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        {
          provide: PrismaService,
          useValue: { usuario: { findUnique, update } },
        },
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  // ---- CPF ----------------------------------------------------------------

  it('CPF válido (formatado) é aceito e normalizado antes de persistir', async () => {
    const resultado = await service.atualizarMeusDados(1, {
      nome: 'Cliente Um',
      email: 'um@sensora.dev',
      cpf: '529.982.247-25',
    });

    expect(resultado.cpf).toBe('52998224725');
  });

  it('CPF inválido (dígito verificador incorreto) é rejeitado com BadRequestException', async () => {
    await expect(
      service.atualizarMeusDados(1, {
        nome: 'Cliente Um',
        email: 'um@sensora.dev',
        cpf: '123.456.789-00',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('CPF com todos os dígitos iguais é rejeitado', async () => {
    await expect(
      service.atualizarMeusDados(1, {
        nome: 'Cliente Um',
        email: 'um@sensora.dev',
        cpf: '111.111.111-11',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('CPF vazio ("") limpa o campo — volta a null', async () => {
    usuariosFake.set(1, usuarioBase({ cpf: '52998224725' }));

    const resultado = await service.atualizarMeusDados(1, {
      nome: 'Cliente Um',
      email: 'um@sensora.dev',
      cpf: '',
    });

    expect(resultado.cpf).toBeNull();
  });

  it('CPF ausente no DTO não altera o CPF já salvo', async () => {
    usuariosFake.set(1, usuarioBase({ cpf: '52998224725' }));

    const resultado = await service.atualizarMeusDados(1, {
      nome: 'Cliente Um',
      email: 'um@sensora.dev',
    });

    expect(resultado.cpf).toBe('52998224725');
  });

  it('usuário reenviando o próprio CPF (já salvo) é permitido, não é tratado como duplicidade', async () => {
    usuariosFake.set(1, usuarioBase({ cpf: '52998224725' }));

    const resultado = await service.atualizarMeusDados(1, {
      nome: 'Cliente Um',
      email: 'um@sensora.dev',
      cpf: '529.982.247-25',
    });

    expect(resultado.cpf).toBe('52998224725');
  });

  it('CPF duplicado (pertence a outro usuário) retorna ConflictException, sem vazar dados do outro usuário', async () => {
    // Usuário 2 já tem CPF 11144477735 (ver usuariosFake acima).
    await expect(
      service.atualizarMeusDados(1, {
        nome: 'Cliente Um',
        email: 'um@sensora.dev',
        cpf: '111.444.777-35',
      }),
    ).rejects.toThrow(ConflictException);

    try {
      await service.atualizarMeusDados(1, {
        nome: 'Cliente Um',
        email: 'um@sensora.dev',
        cpf: '111.444.777-35',
      });
    } catch (erro) {
      const mensagem = (erro as ConflictException).message;
      // A mensagem nunca cita o nome/e-mail/id do dono real do CPF.
      expect(mensagem).not.toContain('Cliente Dois');
      expect(mensagem).not.toContain('dois@sensora.dev');
      expect(mensagem).not.toContain('2');
    }
  });

  it('P2002 do Prisma na escrita (corrida entre duas requisições simultâneas) também vira ConflictException', async () => {
    update.mockImplementationOnce(() => {
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`cpf`)', {
        code: 'P2002',
        clientVersion: 'test',
      });
    });

    await expect(
      service.atualizarMeusDados(1, {
        nome: 'Cliente Um',
        email: 'um@sensora.dev',
        cpf: '529.982.247-25',
      }),
    ).rejects.toThrow(ConflictException);
  });

  // ---- Telefone -------------------------------------------------------------

  it('telefone válido (formatado) é aceito e normalizado antes de persistir', async () => {
    const resultado = await service.atualizarMeusDados(1, {
      nome: 'Cliente Um',
      email: 'um@sensora.dev',
      telefone: '(41) 99999-9999',
    });

    expect(resultado.telefone).toBe('41999999999');
  });

  it('telefone já normalizado é aceito', async () => {
    const resultado = await service.atualizarMeusDados(1, {
      nome: 'Cliente Um',
      email: 'um@sensora.dev',
      telefone: '4133333333',
    });

    expect(resultado.telefone).toBe('4133333333');
  });

  it('telefone inválido (quantidade de dígitos incompatível) é rejeitado', async () => {
    await expect(
      service.atualizarMeusDados(1, {
        nome: 'Cliente Um',
        email: 'um@sensora.dev',
        telefone: '123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('telefone ausente no DTO não altera o telefone já salvo', async () => {
    usuariosFake.set(1, usuarioBase({ telefone: '41999999999' }));

    const resultado = await service.atualizarMeusDados(1, {
      nome: 'Cliente Um',
      email: 'um@sensora.dev',
    });

    expect(resultado.telefone).toBe('41999999999');
  });

  it('telefone vazio ("") limpa o campo — volta a null', async () => {
    usuariosFake.set(1, usuarioBase({ telefone: '41999999999' }));

    const resultado = await service.atualizarMeusDados(1, {
      nome: 'Cliente Um',
      email: 'um@sensora.dev',
      telefone: '',
    });

    expect(resultado.telefone).toBeNull();
  });

  // ---- findOne (GET /usuarios/me) --------------------------------------

  it('findOne (GET /usuarios/me) devolve cpf/telefone salvos, nunca a senha', async () => {
    usuariosFake.set(
      1,
      usuarioBase({ cpf: '52998224725', telefone: '41999999999', senha: 'hash-nunca-deveria-sair' }),
    );

    const resultado = await service.findOne(1);

    expect(resultado.cpf).toBe('52998224725');
    expect(resultado.telefone).toBe('41999999999');
    expect(resultado).not.toHaveProperty('senha');
  });

  it('findOne (GET /usuarios/me) devolve cpf/telefone null quando nunca preenchidos', async () => {
    const resultado = await service.findOne(1);

    expect(resultado.cpf).toBeNull();
    expect(resultado.telefone).toBeNull();
  });
});

// Etapa "Dados do Cliente / Cadastro" (fechamento administrativo) — mesma
// cobertura de CPF/telefone da suíte acima, agora exercitando create()/
// update() (fluxo ADMIN via /admin/usuarios), que passam a reaproveitar os
// mesmos helpers privados (normalizarEValidarCpfParaUsuario/
// normalizarEValidarTelefone). Banco em memória (Map por id), mesmo
// raciocínio da suíte de atualizarMeusDados acima.
describe('UsuariosService — create/update administrativo: CPF/telefone', () => {
  let service: UsuariosService;
  let usuariosFake: Map<number, Record<string, unknown>>;
  let nextId: number;
  let findUnique: jest.Mock;
  let create: jest.Mock;
  let update: jest.Mock;

  function usuarioBase(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 1,
      nome: 'Usuario Base',
      email: 'base@sensora.dev',
      senha: 'hash',
      perfil: PerfilUsuario.CLIENTE,
      ativo: true,
      emailVerificado: true,
      cpf: null,
      telefone: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    // Usuário 2 já existe com CPF 11144477735 — usado nos testes de
    // duplicidade (create e update de OUTRO usuário).
    usuariosFake = new Map([
      [2, usuarioBase({ id: 2, email: 'outro@sensora.dev', cpf: '11144477735' })],
    ]);
    nextId = 10;

    findUnique = jest.fn(
      ({ where }: { where: { id?: number; cpf?: string } }) => {
        if (where.id !== undefined) return usuariosFake.get(where.id) ?? null;
        if (where.cpf !== undefined) {
          return (
            [...usuariosFake.values()].find((u) => u.cpf === where.cpf) ?? null
          );
        }
        return null;
      },
    );

    create = jest.fn(({ data }: { data: Record<string, unknown> }) => {
      const id = nextId;
      nextId += 1;
      const usuario = { id, ...data };
      usuariosFake.set(id, usuario);
      return usuario;
    });

    update = jest.fn(
      ({
        where,
        data,
      }: {
        where: { id: number };
        data: Record<string, unknown>;
      }) => {
        const atual = usuariosFake.get(where.id)!;
        const atualizado = { ...atual, ...data };
        usuariosFake.set(where.id, atualizado);
        return atualizado;
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        {
          provide: PrismaService,
          useValue: { usuario: { findUnique, create, update } },
        },
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  // ---- create (POST /usuarios) --------------------------------------------

  it('ADMIN cria usuário com CPF válido (formatado): normalizado antes de persistir', async () => {
    const resultado = await service.create({
      nome: 'Novo Usuario',
      email: 'novo1@sensora.dev',
      senha: 'senhaSegura123',
      perfil: PerfilUsuario.VENDEDOR,
      cpf: '529.982.247-25',
    });

    expect(resultado.cpf).toBe('52998224725');
  });

  it('ADMIN cria usuário com telefone válido (formatado): normalizado antes de persistir', async () => {
    const resultado = await service.create({
      nome: 'Novo Usuario',
      email: 'novo2@sensora.dev',
      senha: 'senhaSegura123',
      perfil: PerfilUsuario.VENDEDOR,
      telefone: '(41) 99999-9999',
    });

    expect(resultado.telefone).toBe('41999999999');
  });

  it('criação com CPF inválido é rejeitada com BadRequestException, sem chamar prisma.usuario.create', async () => {
    await expect(
      service.create({
        nome: 'Novo Usuario',
        email: 'novo3@sensora.dev',
        senha: 'senhaSegura123',
        perfil: PerfilUsuario.VENDEDOR,
        cpf: '123.456.789-00',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(create).not.toHaveBeenCalled();
  });

  it('criação com CPF já usado por outro usuário é rejeitada com ConflictException', async () => {
    // Usuário 2 já tem CPF 11144477735 (ver usuariosFake acima).
    await expect(
      service.create({
        nome: 'Novo Usuario',
        email: 'novo4@sensora.dev',
        senha: 'senhaSegura123',
        perfil: PerfilUsuario.VENDEDOR,
        cpf: '111.444.777-35',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('criação com telefone inválido é rejeitada com BadRequestException', async () => {
    await expect(
      service.create({
        nome: 'Novo Usuario',
        email: 'novo5@sensora.dev',
        senha: 'senhaSegura123',
        perfil: PerfilUsuario.VENDEDOR,
        telefone: '123',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('criação sem CPF/telefone no DTO não grava os campos (ficam null pelo default do schema)', async () => {
    await service.create({
      nome: 'Novo Usuario',
      email: 'novo6@sensora.dev',
      senha: 'senhaSegura123',
      perfil: PerfilUsuario.VENDEDOR,
    });

    const dataEnviada = create.mock.calls[0][0].data as Record<string, unknown>;
    expect(dataEnviada).not.toHaveProperty('cpf');
    expect(dataEnviada).not.toHaveProperty('telefone');
  });

  it('P2002 do Prisma na criação (corrida entre duas requisições simultâneas) também vira ConflictException', async () => {
    create.mockImplementationOnce(() => {
      throw new Prisma.PrismaClientKnownRequestError('Unique constraint failed on the fields: (`cpf`)', {
        code: 'P2002',
        clientVersion: 'test',
      });
    });

    await expect(
      service.create({
        nome: 'Corrida',
        email: 'corrida@sensora.dev',
        senha: 'senhaSegura123',
        perfil: PerfilUsuario.VENDEDOR,
        cpf: '529.982.247-25',
      }),
    ).rejects.toThrow(ConflictException);
  });

  // ---- update (PUT /usuarios/:id) -----------------------------------------

  it('ADMIN edita o CPF de outro usuário: normalizado antes de persistir', async () => {
    usuariosFake.set(3, usuarioBase({ id: 3, email: 'tres@sensora.dev' }));

    const resultado = await service.update(3, { cpf: '529.982.247-25' });

    expect(resultado.cpf).toBe('52998224725');
  });

  it('ADMIN edita o telefone de outro usuário: normalizado antes de persistir', async () => {
    usuariosFake.set(3, usuarioBase({ id: 3, email: 'tres@sensora.dev' }));

    const resultado = await service.update(3, { telefone: '(41) 3333-3333' });

    expect(resultado.telefone).toBe('4133333333');
  });

  it('edição com CPF inválido é rejeitada com BadRequestException', async () => {
    usuariosFake.set(3, usuarioBase({ id: 3, email: 'tres@sensora.dev' }));

    await expect(
      service.update(3, { cpf: '123.456.789-00' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('edição com CPF já usado por outro usuário é rejeitada com ConflictException', async () => {
    usuariosFake.set(3, usuarioBase({ id: 3, email: 'tres@sensora.dev' }));

    await expect(
      service.update(3, { cpf: '111.444.777-35' }),
    ).rejects.toThrow(ConflictException);
  });

  it('edição reenviando o próprio CPF já salvo não é tratada como duplicidade', async () => {
    usuariosFake.set(
      3,
      usuarioBase({ id: 3, email: 'tres@sensora.dev', cpf: '52998224725' }),
    );

    const resultado = await service.update(3, { cpf: '529.982.247-25' });

    expect(resultado.cpf).toBe('52998224725');
  });

  it('edição com telefone inválido é rejeitada com BadRequestException', async () => {
    usuariosFake.set(3, usuarioBase({ id: 3, email: 'tres@sensora.dev' }));

    await expect(
      service.update(3, { telefone: '123' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('CPF vazio ("") limpa o campo — volta a null', async () => {
    usuariosFake.set(
      3,
      usuarioBase({ id: 3, email: 'tres@sensora.dev', cpf: '52998224725' }),
    );

    const resultado = await service.update(3, { cpf: '' });

    expect(resultado.cpf).toBeNull();
  });

  it('telefone vazio ("") limpa o campo — volta a null', async () => {
    usuariosFake.set(
      3,
      usuarioBase({ id: 3, email: 'tres@sensora.dev', telefone: '41999999999' }),
    );

    const resultado = await service.update(3, { telefone: '' });

    expect(resultado.telefone).toBeNull();
  });

  it('edição sem CPF/telefone no DTO não altera os valores já salvos', async () => {
    usuariosFake.set(
      3,
      usuarioBase({
        id: 3,
        email: 'tres@sensora.dev',
        cpf: '52998224725',
        telefone: '41999999999',
      }),
    );

    const resultado = await service.update(3, { nome: 'Tres Editado' });

    expect(resultado.cpf).toBe('52998224725');
    expect(resultado.telefone).toBe('41999999999');
  });
});

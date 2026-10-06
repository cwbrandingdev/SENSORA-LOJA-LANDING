import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '../../generated/prisma/client';
import { EnderecosService } from '../enderecos/enderecos.service';
import { PrismaService } from '../prisma/prisma.service';
import { PerfilUsuario } from './enums/perfil-usuario.enum';
import { UsuariosService } from './usuarios.service';

// Fase B (Admin/Clientes reais) — UsuariosService passou a depender de
// EnderecosService (só usado por buscarDetalheCliente, nunca pelos métodos
// cobertos nesta suíte). Stub vazio, reaproveitado em todo `describe` deste
// arquivo só para satisfazer a resolução de dependências do Nest — nenhum
// destes testes chama buscarDetalheCliente nem precisa de comportamento
// real aqui.
const ENDERECOS_SERVICE_STUB = {
  provide: EnderecosService,
  useValue: {},
};

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
        {
          provide: PrismaService,
          // findUnique: checagem de e-mail duplicado em create() — nenhum
          // usuário existente nestes cenários.
          useValue: {
            usuario: {
              create: prismaCreate,
              findUnique: jest.fn().mockResolvedValue(null),
            },
          },
        },
        ENDERECOS_SERVICE_STUB,
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
        ENDERECOS_SERVICE_STUB,
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  // ---- E-mail (normalização + troca fica pendente — MÉDIO-3) --------------

  it('troca de e-mail grava só o pendente (normalizado) com hash e validade; email e emailVerificado não mudam', async () => {
    const expira = new Date('2030-01-01T00:00:00Z');
    const resultado = await service.atualizarMeusDados(
      1,
      { nome: 'Cliente Um', email: '  NOVO@GMAIL.COM ' },
      { emailPendenteTokenHash: 'hash-novo', emailPendenteExpiraEm: expira },
    );

    expect(update).toHaveBeenCalledTimes(1);
    const [{ data }] = update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data).toEqual({
      nome: 'Cliente Um',
      emailPendente: 'novo@gmail.com',
      emailPendenteTokenHash: 'hash-novo',
      emailPendenteExpiraEm: expira,
    });
    expect(resultado.email).toBe('um@sensora.dev');
    expect(resultado.emailVerificado).toBe(true);
    expect(resultado.emailPendente).toBe('novo@gmail.com');
  });

  it('mesmo e-mail com outra caixa/espaços NÃO é troca: não grava email nem mexe na verificação', async () => {
    const resultado = await service.atualizarMeusDados(1, {
      nome: 'Cliente Um Editado',
      email: ' UM@Sensora.DEV ',
    });

    expect(resultado.emailVerificado).toBe(true);
    const [{ data }] = update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data).toEqual({ nome: 'Cliente Um Editado' });
  });

  it('mesmo e-mail atual com uma troca pendente: o pendente é preservado (nome/CPF/telefone também enviam o e-mail)', async () => {
    const expira = new Date(Date.now() + 60 * 60 * 1000);
    usuariosFake.set(
      1,
      usuarioBase({
        emailPendente: 'novo@gmail.com',
        emailPendenteTokenHash: 'hash-pendente',
        emailPendenteExpiraEm: expira,
      }),
    );

    const resultado = await service.atualizarMeusDados(1, {
      nome: 'Cliente Um Editado',
      email: 'um@sensora.dev',
    });

    const [{ data }] = update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(data).not.toHaveProperty('emailPendente');
    expect(data).not.toHaveProperty('emailPendenteTokenHash');
    expect(usuariosFake.get(1)).toMatchObject({
      emailPendente: 'novo@gmail.com',
      emailPendenteTokenHash: 'hash-pendente',
    });
    expect(resultado.emailPendente).toBe('novo@gmail.com');
  });

  it('nova troca antes de confirmar (A → B, depois A → C) sobrescreve pendente, hash e validade', async () => {
    const expiraB = new Date(Date.now() + 60 * 60 * 1000);
    const expiraC = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await service.atualizarMeusDados(
      1,
      { nome: 'Cliente Um', email: 'b@sensora.dev' },
      { emailPendenteTokenHash: 'hash-b', emailPendenteExpiraEm: expiraB },
    );
    await service.atualizarMeusDados(
      1,
      { nome: 'Cliente Um', email: 'c@sensora.dev' },
      { emailPendenteTokenHash: 'hash-c', emailPendenteExpiraEm: expiraC },
    );

    expect(usuariosFake.get(1)).toMatchObject({
      email: 'um@sensora.dev',
      emailPendente: 'c@sensora.dev',
      emailPendenteTokenHash: 'hash-c',
      emailPendenteExpiraEm: expiraC,
    });
  });

  it('e-mail pendente de OUTRA conta não é conflito (o pendente não reserva o endereço)', async () => {
    usuariosFake.set(2, {
      ...usuariosFake.get(2)!,
      emailPendente: 'disputado@sensora.dev',
    });

    await service.atualizarMeusDados(
      1,
      { nome: 'Cliente Um', email: 'disputado@sensora.dev' },
      {
        emailPendenteTokenHash: 'hash-1',
        emailPendenteExpiraEm: new Date(Date.now() + 60_000),
      },
    );

    expect(usuariosFake.get(1)).toMatchObject({
      emailPendente: 'disputado@sensora.dev',
    });
  });

  it('e-mail de outra conta com caixa diferente é conflito (sem duplicidade por maiúsculas)', async () => {
    await expect(
      service.atualizarMeusDados(1, {
        nome: 'Cliente Um',
        email: 'DOIS@SENSORA.DEV',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(update).not.toHaveBeenCalled();
  });

  it('buscarPorEmail normaliza a entrada antes de consultar', async () => {
    const encontrado = await service.buscarPorEmail('  Dois@SENSORA.dev ');
    expect(encontrado?.id).toBe(2);
  });

  it('buscarPorEmail procura só pelo e-mail oficial, nunca pelo pendente (login/forgot-password)', async () => {
    usuariosFake.set(1, usuarioBase({ emailPendente: 'pendente@sensora.dev' }));

    expect(await service.buscarPorEmail('pendente@sensora.dev')).toBeNull();
    expect(findUnique).toHaveBeenCalledWith({
      where: { email: 'pendente@sensora.dev' },
    });
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
        ENDERECOS_SERVICE_STUB,
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  // ---- update (PUT /usuarios/:id): troca de e-mail pendente (MÉDIO-3) -----

  it('ADMIN alterando o e-mail descarta a troca pendente do usuário', async () => {
    usuariosFake.set(
      5,
      usuarioBase({
        id: 5,
        email: 'antigo@sensora.dev',
        emailPendente: 'pendente@sensora.dev',
        emailPendenteTokenHash: 'hash-pendente',
        emailPendenteExpiraEm: new Date(Date.now() + 60_000),
      }),
    );

    await service.update(5, { email: 'Definido@Admin.dev' });

    expect(usuariosFake.get(5)).toMatchObject({
      email: 'definido@admin.dev',
      emailPendente: null,
      emailPendenteTokenHash: null,
      emailPendenteExpiraEm: null,
    });
  });

  it('ADMIN alterando outro campo (sem trocar o e-mail) preserva a troca pendente', async () => {
    usuariosFake.set(
      5,
      usuarioBase({
        id: 5,
        email: 'antigo@sensora.dev',
        emailPendente: 'pendente@sensora.dev',
        emailPendenteTokenHash: 'hash-pendente',
      }),
    );

    await service.update(5, {
      nome: 'Outro Nome',
      email: 'antigo@sensora.dev',
    });

    expect(usuariosFake.get(5)).toMatchObject({
      emailPendente: 'pendente@sensora.dev',
      emailPendenteTokenHash: 'hash-pendente',
    });
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

// Etapa 8.3 (achado HIGH da auditoria — resetToken em texto puro) —
// primeira suíte automatizada destes três métodos. Prova que a coluna
// usada é `resetTokenHash` (não a antiga `resetToken`, removida do schema
// nesta mesma etapa) e que redefinirSenha() preserva o uso único (hash e
// expiração sempre limpos junto com a troca de senha, mesmo raciocínio de
// confirmarEmailSeHashValido para emailVerificationHash).
describe('UsuariosService — salvarTokenReset/buscarPorResetToken/redefinirSenha (Etapa 8.3)', () => {
  let service: UsuariosService;
  let prisma: {
    usuario: { update: jest.Mock; updateMany: jest.Mock; findFirst: jest.Mock };
  };

  beforeEach(async () => {
    prisma = {
      usuario: {
        update: jest.fn(({ data }: { data: Record<string, unknown> }) => ({
          id: 1,
          ...data,
        })),
        updateMany: jest.fn(() => ({ count: 1 })),
        findFirst: jest.fn(() => null),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
        ENDERECOS_SERVICE_STUB,
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  it('salvarTokenReset(): grava no campo resetTokenHash (nunca em resetToken), condicionado ao cooldown, e devolve true', async () => {
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    const expiryAnteriorAte = new Date(Date.now() + 59 * 60 * 1000);

    const gravou = await service.salvarTokenReset(
      1,
      'hash-fake-64-caracteres',
      expiry,
      expiryAnteriorAte,
    );

    expect(gravou).toBe(true);
    expect(prisma.usuario.update).not.toHaveBeenCalled();
    expect(prisma.usuario.updateMany).toHaveBeenCalledWith({
      where: {
        id: 1,
        OR: [
          { resetTokenExpiry: null },
          { resetTokenExpiry: { lte: expiryAnteriorAte } },
        ],
      },
      data: { resetTokenHash: 'hash-fake-64-caracteres', resetTokenExpiry: expiry },
    });
    const [[{ data: dataEnviada }]] = prisma.usuario.updateMany.mock.calls as [
      [{ data: Record<string, unknown> }],
    ];
    expect(dataEnviada).not.toHaveProperty('resetToken');
  });

  // MÉDIO-5 — dentro do cooldown (ou perdendo uma corrida) o updateMany
  // condicional não afeta nenhuma linha: nada é gravado e devolve false.
  it('salvarTokenReset(): count 0 (dentro do cooldown) devolve false', async () => {
    prisma.usuario.updateMany.mockReturnValueOnce({ count: 0 });

    const gravou = await service.salvarTokenReset(
      1,
      'hash-fake-64-caracteres',
      new Date(Date.now() + 60 * 60 * 1000),
      new Date(Date.now() + 59 * 60 * 1000),
    );

    expect(gravou).toBe(false);
  });

  it('buscarPorResetToken(): consulta pelo campo resetTokenHash (nunca resetToken)', async () => {
    await service.buscarPorResetToken('hash-fake-64-caracteres');

    expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
      where: { resetTokenHash: 'hash-fake-64-caracteres' },
      select: { id: true, resetTokenExpiry: true },
    });
  });

  // Caso E (Etapa 8.3) — uso único: após redefinir a senha, o hash e a
  // expiração são sempre limpos na mesma escrita — uma segunda tentativa
  // com o mesmo token deixa de encontrar qualquer usuário por
  // buscarPorResetToken (a busca é por resetTokenHash === null nunca bate
  // com nenhum hash calculado a partir de um token real).
  it('redefinirSenha(): limpa resetTokenHash/resetTokenExpiry e nunca grava a senha em texto puro (uso único)', async () => {
    await service.redefinirSenha(1, 'novaSenhaSegura123');

    expect(prisma.usuario.update).toHaveBeenCalledTimes(1);
    const dataEnviada = prisma.usuario.update.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(dataEnviada.resetTokenHash).toBeNull();
    expect(dataEnviada.resetTokenExpiry).toBeNull();
    expect(dataEnviada.senha).not.toBe('novaSenhaSegura123');
    expect(typeof dataEnviada.senha).toBe('string');
  });

  it('redefinirSenha(): descarta a troca de e-mail pendente (MÉDIO-3)', async () => {
    await service.redefinirSenha(1, 'novaSenhaSegura123');

    const [{ data: dataEnviada }] = prisma.usuario.update.mock.calls[0] as [
      { data: Record<string, unknown> },
    ];
    expect(dataEnviada.emailPendente).toBeNull();
    expect(dataEnviada.emailPendenteTokenHash).toBeNull();
    expect(dataEnviada.emailPendenteExpiraEm).toBeNull();
  });
});

// Etapa 10 / AUTH-04 (achado da auditoria — reuso de refresh token sem
// revogação em cascata) — revogarTodosRefreshTokensAtivos() já existia
// (usado por resetPassword/alterarMinhaSenha) mas nunca tinha um teste
// próprio. Passa a ser reaproveitado também por AuthService.refresh() ao
// detectar reuso (ver auth.service.spec.ts) — a prova de que isso revoga
// "B e C" (todos os tokens ativos de um usuário, não só o token
// especificamente apresentado) está aqui: o `where` não filtra por
// tokenHash algum, só por usuarioId + revokedAt:null — por definição,
// atinge QUALQUER token ativo daquele usuário, não importa qual token
// disparou a chamada.
describe('UsuariosService — revogarTodosRefreshTokensAtivos (Etapa 10 / AUTH-04: contenção em cascata)', () => {
  let service: UsuariosService;
  let prisma: { refreshToken: { updateMany: jest.Mock } };

  beforeEach(async () => {
    prisma = {
      refreshToken: {
        updateMany: jest.fn(() => ({ count: 2 })),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
        ENDERECOS_SERVICE_STUB,
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  it('revoga TODOS os refresh tokens ativos do usuário — sem filtrar por um token específico (é isso que garante que B e C também sejam revogados, não só o token A que disparou a chamada)', async () => {
    await service.revogarTodosRefreshTokensAtivos(1);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 1, revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('escopo é só o usuarioId informado — o where não tem nenhuma outra condição que pudesse vazar para tokens de outro usuário', async () => {
    await service.revogarTodosRefreshTokensAtivos(42);

    const chamada = prisma.refreshToken.updateMany.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(chamada.where.usuarioId).toBe(42);
    expect(Object.keys(chamada.where)).toEqual(['usuarioId', 'revokedAt']);
  });

  it('retorna a contagem de tokens efetivamente revogados', async () => {
    const resultado = await service.revogarTodosRefreshTokensAtivos(1);

    expect(resultado).toBe(2);
  });

  it('não afeta tokens já revogados (revokedAt: null no where garante idempotência — chamar duas vezes não é um erro)', async () => {
    await service.revogarTodosRefreshTokensAtivos(1);
    await service.revogarTodosRefreshTokensAtivos(1);

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledTimes(2);
    for (const chamada of prisma.refreshToken.updateMany.mock.calls) {
      expect((chamada[0] as { where: Record<string, unknown> }).where).toEqual(
        { usuarioId: 1, revokedAt: null },
      );
    }
  });
});

// MÉDIO-3 — troca de e-mail pendente: exposição em paraPublico e efetivação
// na confirmação (uso único, P2002 vira 409 e descarta o pendente).
describe('UsuariosService — e-mail pendente: paraPublico e confirmação (MÉDIO-3)', () => {
  let service: UsuariosService;
  let usuariosFake: Map<number, Record<string, unknown>>;
  let prisma: {
    usuario: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      updateMany: jest.Mock;
    };
  };

  function usuarioBase(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      id: 1,
      nome: 'Cliente Um',
      email: 'um@sensora.dev',
      perfil: PerfilUsuario.CLIENTE,
      ativo: true,
      emailVerificado: true,
      emailVerificadoEm: null,
      emailPendente: 'novo@sensora.dev',
      emailPendenteTokenHash: 'hash-pendente',
      emailPendenteExpiraEm: new Date(Date.now() + 60 * 60 * 1000),
      cpf: null,
      telefone: null,
      ...overrides,
    };
  }

  beforeEach(async () => {
    usuariosFake = new Map([[1, usuarioBase()]]);
    prisma = {
      usuario: {
        findUnique: jest.fn(
          ({ where }: { where: { id: number } }) =>
            usuariosFake.get(where.id) ?? null,
        ),
        findFirst: jest.fn(),
        // Mesma semântica do Postgres: só atualiza se TODAS as condições do
        // where ainda baterem no momento da escrita.
        updateMany: jest.fn(
          ({
            where,
            data,
          }: {
            where: Record<string, unknown>;
            data: Record<string, unknown>;
          }) => {
            const atual = usuariosFake.get(where.id as number);
            const bate =
              !!atual &&
              Object.entries(where).every(
                ([campo, valor]) => atual[campo] === valor,
              );
            if (!bate) return { count: 0 };
            usuariosFake.set(where.id as number, { ...atual, ...data });
            return { count: 1 };
          },
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsuariosService,
        { provide: PrismaService, useValue: prisma },
        ENDERECOS_SERVICE_STUB,
      ],
    }).compile();

    service = module.get(UsuariosService);
  });

  it('paraPublico (GET /usuarios/me) mostra o pendente enquanto o link vale', async () => {
    const publico = await service.findOne(1);
    expect(publico.email).toBe('um@sensora.dev');
    expect(publico.emailPendente).toBe('novo@sensora.dev');
    expect(publico).not.toHaveProperty('emailPendenteTokenHash');
    expect(publico).not.toHaveProperty('emailPendenteExpiraEm');
  });

  it('paraPublico não mostra pendente expirado', async () => {
    usuariosFake.set(
      1,
      usuarioBase({ emailPendenteExpiraEm: new Date(Date.now() - 1000) }),
    );
    expect((await service.findOne(1)).emailPendente).toBeNull();
  });

  it('buscarPorHashEmailPendente consulta pelo hash da troca', async () => {
    await service.buscarPorHashEmailPendente('hash-pendente');
    expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
      where: { emailPendenteTokenHash: 'hash-pendente' },
      select: { id: true, emailPendente: true, emailPendenteExpiraEm: true },
    });
  });

  it('confirmação válida: pendente vira o e-mail oficial, verificado, com data, e os campos pendentes são limpos', async () => {
    const count = await service.confirmarEmailPendenteSeHashValido(
      1,
      'hash-pendente',
      'novo@sensora.dev',
    );

    expect(count).toBe(1);
    const usuario = usuariosFake.get(1)!;
    expect(usuario).toMatchObject({
      email: 'novo@sensora.dev',
      emailVerificado: true,
      emailPendente: null,
      emailPendenteTokenHash: null,
      emailPendenteExpiraEm: null,
    });
    expect(usuario.emailVerificadoEm).toBeInstanceOf(Date);
  });

  it('uso único: a segunda confirmação com o mesmo hash não altera nada (count 0)', async () => {
    await service.confirmarEmailPendenteSeHashValido(
      1,
      'hash-pendente',
      'novo@sensora.dev',
    );
    const segunda = await service.confirmarEmailPendenteSeHashValido(
      1,
      'hash-pendente',
      'novo@sensora.dev',
    );

    expect(segunda).toBe(0);
    expect(prisma.usuario.updateMany).toHaveBeenCalledTimes(2);
  });

  it('confirmações concorrentes: só uma efetiva a troca', async () => {
    const resultados = await Promise.all([
      service.confirmarEmailPendenteSeHashValido(
        1,
        'hash-pendente',
        'novo@sensora.dev',
      ),
      service.confirmarEmailPendenteSeHashValido(
        1,
        'hash-pendente',
        'novo@sensora.dev',
      ),
    ]);

    expect(resultados.sort()).toEqual([0, 1]);
    expect(usuariosFake.get(1)!.email).toBe('novo@sensora.dev');
  });

  it('P2002 (outra conta passou a usar o endereço): 409, a conta mantém o e-mail atual e o pendente é descartado', async () => {
    prisma.usuario.updateMany.mockImplementationOnce(() => {
      throw new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        { code: 'P2002', clientVersion: 'test' },
      );
    });

    await expect(
      service.confirmarEmailPendenteSeHashValido(
        1,
        'hash-pendente',
        'novo@sensora.dev',
      ),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(usuariosFake.get(1)).toMatchObject({
      email: 'um@sensora.dev',
      emailVerificado: true,
      emailPendente: null,
      emailPendenteTokenHash: null,
      emailPendenteExpiraEm: null,
    });
  });
});

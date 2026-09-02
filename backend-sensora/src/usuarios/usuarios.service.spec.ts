import { Test, TestingModule } from '@nestjs/testing';
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

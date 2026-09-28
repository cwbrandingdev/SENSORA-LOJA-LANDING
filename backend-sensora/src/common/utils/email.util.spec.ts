import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { LoginDto } from '../../auth/dto/login.dto';
import { RegisterDto } from '../../auth/dto/register.dto';
import { AtualizarMeusDadosDto } from '../../usuarios/dto/atualizar-meus-dados.dto';
import { normalizarEmail } from './email.util';

describe('normalizarEmail', () => {
  it('remove espaços nas pontas e converte para minúsculas', () => {
    expect(normalizarEmail('  TESTE@GMAIL.COM ')).toBe('teste@gmail.com');
  });

  it('não mexe em um e-mail já normalizado', () => {
    expect(normalizarEmail('teste@gmail.com')).toBe('teste@gmail.com');
  });
});

// Mesmo caminho do ValidationPipe global (transform: true): class-transformer
// primeiro, class-validator depois.
describe('@NormalizarEmail nos DTOs', () => {
  it('cadastro: "  TESTE@GMAIL.COM " vira "teste@gmail.com" e passa no @IsEmail', async () => {
    const dto = plainToInstance(RegisterDto, {
      nome: 'Teste',
      email: '  TESTE@GMAIL.COM ',
      senha: 'senhaSegura123',
      cpf: '52998224725',
    });

    expect(dto.email).toBe('teste@gmail.com');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('login: e-mail com caixa diferente é normalizado', async () => {
    const dto = plainToInstance(LoginDto, { email: 'Teste@Gmail.Com', senha: 'x' });

    expect(dto.email).toBe('teste@gmail.com');
    expect(await validate(dto)).toHaveLength(0);
  });

  it('Minha Conta: e-mail novo é normalizado', () => {
    const dto = plainToInstance(AtualizarMeusDadosDto, {
      nome: 'Teste',
      email: ' Novo@Outlook.COM',
    });

    expect(dto.email).toBe('novo@outlook.com');
  });

  it('domínio legítimo incomum (.co) continua aceito — nenhum bloqueio por domínio', async () => {
    const dto = plainToInstance(LoginDto, { email: 'alguem@empresa.co', senha: 'x' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('valor que não é string não é transformado e continua reprovado pelo @IsEmail', async () => {
    const dto = plainToInstance(LoginDto, { email: 123, senha: 'x' });
    const erros = await validate(dto);
    expect(erros.map((e) => e.property)).toContain('email');
  });
});

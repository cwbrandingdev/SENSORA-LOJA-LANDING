import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateUsuarioDto } from '../../usuarios/dto/create-usuario.dto';
import { UpdateUsuarioDto } from '../../usuarios/dto/update-usuario.dto';
import { PerfilUsuario } from '../../usuarios/enums/perfil-usuario.enum';
import { AlterarMinhaSenhaDto } from './change-password.dto';
import { RegisterDto } from './register.dto';
import { ResetPasswordDto } from './reset-password.dto';

// Vistoria de proteção de dados — o bcrypt só considera os primeiros 72
// bytes da senha, então os DTOs de senha nova limitam a 72 caracteres.

const CASOS: {
  nome: string;
  campo: string;
  montar: (senha: string) => object;
}[] = [
  {
    nome: 'RegisterDto',
    campo: 'senha',
    montar: (senha) =>
      plainToInstance(RegisterDto, {
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        senha,
        cpf: '529.982.247-25',
      }),
  },
  {
    nome: 'CreateUsuarioDto',
    campo: 'senha',
    montar: (senha) =>
      plainToInstance(CreateUsuarioDto, {
        nome: 'Cliente',
        email: 'cliente@sensora.dev',
        senha,
        perfil: PerfilUsuario.CLIENTE,
      }),
  },
  {
    nome: 'UpdateUsuarioDto',
    campo: 'senha',
    montar: (senha) => plainToInstance(UpdateUsuarioDto, { senha }),
  },
  {
    nome: 'AlterarMinhaSenhaDto',
    campo: 'novaSenha',
    montar: (novaSenha) =>
      plainToInstance(AlterarMinhaSenhaDto, {
        senhaAtual: 'senhaAtual123',
        novaSenha,
      }),
  },
  {
    nome: 'ResetPasswordDto',
    campo: 'novaSenha',
    montar: (novaSenha) =>
      plainToInstance(ResetPasswordDto, {
        token: 'a'.repeat(64),
        novaSenha,
      }),
  },
];

describe.each(CASOS)('$nome — tamanho da senha', ({ campo, montar }) => {
  it('senha com 8 caracteres continua válida', async () => {
    expect(await validate(montar('a'.repeat(8)))).toHaveLength(0);
  });

  it('senha com 72 caracteres continua válida', async () => {
    expect(await validate(montar('a'.repeat(72)))).toHaveLength(0);
  });

  it('senha com 73 caracteres é rejeitada (maxLength)', async () => {
    const erros = await validate(montar('a'.repeat(73)));
    const erroSenha = erros.find((erro) => erro.property === campo);
    expect(erroSenha?.constraints).toHaveProperty('maxLength');
  });
});

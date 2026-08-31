import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateClienteDto {
  // Etapa 10 / Task 6 (achado H8): limite nos campos de texto livre (nome,
  // endereço). telefone/cpf ficaram de fora deliberadamente — são campos
  // estruturados/de formato fixo, não texto livre, e validar o formato
  // deles é um achado separado (não pedido nesta Task).
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  telefone: string;

  @IsString()
  @IsNotEmpty()
  cpf: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  endereco: string;
}

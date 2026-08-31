export class Endereco {
  id: number;
  usuarioId: number;
  rua: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  padrao: boolean;
}

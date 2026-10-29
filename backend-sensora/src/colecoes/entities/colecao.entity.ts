export class Colecao {
  id: number;
  nome: string;
  slug: string;
  chamada?: string;
  titulo?: string;
  descricao?: string;
  imagemUrl?: string;
  ativo: boolean;
  produtoIds: number[];
}

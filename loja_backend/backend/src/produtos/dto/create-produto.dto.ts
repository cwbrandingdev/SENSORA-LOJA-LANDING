import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

// Etapa 10 / Task 6 (achado H12): aceita URL absoluta http(s) OU caminho
// relativo começando com "/" — mesmo padrão já validado no frontend
// (components/forms/ProductForm.tsx). Um @IsUrl() puro rejeitaria dados
// reais já existentes no banco (ex.: produtos com imagemUrl apontando para
// /images/products/... servido pelo próprio frontend, fora do ImageKit).
const IMAGEM_URL_PATTERN = /^(https?:\/\/|\/)/;
const IMAGEM_URL_MENSAGEM =
  'imagemUrl deve ser uma URL http(s) válida ou um caminho relativo começando com "/"';

export class CreateProdutoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nome: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  descricao?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  aroma?: string;

  @IsString()
  @IsOptional()
  @Matches(IMAGEM_URL_PATTERN, { message: IMAGEM_URL_MENSAGEM })
  imagemUrl?: string;

  @IsBoolean()
  @IsOptional()
  ativo?: boolean;

  @IsBoolean()
  @IsOptional()
  destaque?: boolean;

  @IsInt()
  @IsOptional()
  categoriaId?: number;

  @IsNumber()
  @IsPositive()
  preco: number;

  @IsInt()
  @Min(0)
  quantidade: number;
}

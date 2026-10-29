import { IsBoolean } from 'class-validator';

export class AlterarAtivoCategoriaDto {
  @IsBoolean()
  ativo: boolean;
}

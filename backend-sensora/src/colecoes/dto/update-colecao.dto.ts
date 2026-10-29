import { PartialType } from '@nestjs/mapped-types';
import { CreateColecaoDto } from './create-colecao.dto';

export class UpdateColecaoDto extends PartialType(CreateColecaoDto) {}

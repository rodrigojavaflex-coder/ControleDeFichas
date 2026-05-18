import { PartialType } from '@nestjs/mapped-types';
import { CreateFuncionarioFolhaDto } from './create-funcionario-folha.dto';

export class UpdateFuncionarioFolhaDto extends PartialType(
  CreateFuncionarioFolhaDto,
) {}

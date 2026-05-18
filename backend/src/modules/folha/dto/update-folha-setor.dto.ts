import { PartialType } from '@nestjs/swagger';
import { CreateFolhaSetorDto } from './create-folha-setor.dto';

export class UpdateFolhaSetorDto extends PartialType(CreateFolhaSetorDto) {}

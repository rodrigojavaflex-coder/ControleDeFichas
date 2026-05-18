import { PartialType } from '@nestjs/mapped-types';
import { CreateFolhaVerbaDto } from './create-folha-verba.dto';

export class UpdateFolhaVerbaDto extends PartialType(CreateFolhaVerbaDto) {}

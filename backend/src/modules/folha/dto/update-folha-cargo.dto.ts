import { PartialType } from '@nestjs/swagger';
import { CreateFolhaCargoDto } from './create-folha-cargo.dto';

export class UpdateFolhaCargoDto extends PartialType(CreateFolhaCargoDto) {}

import { PartialType } from '@nestjs/swagger';
import { CreatePrescritorDto } from './create-prescritor.dto';

export class UpdatePrescritorDto extends PartialType(CreatePrescritorDto) {}


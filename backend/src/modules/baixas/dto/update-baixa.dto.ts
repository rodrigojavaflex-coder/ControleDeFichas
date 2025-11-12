import { PartialType } from '@nestjs/swagger';
import { CreateBaixaDto } from './create-baixa.dto';

export class UpdateBaixaDto extends PartialType(CreateBaixaDto) {}
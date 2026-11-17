import { PartialType } from '@nestjs/swagger';
import { CreateVisitaCorDiaDto } from './create-visita-cor-dia.dto';

export class UpdateVisitaCorDiaDto extends PartialType(CreateVisitaCorDiaDto) {}

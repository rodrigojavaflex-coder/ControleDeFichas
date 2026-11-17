import { PartialType } from '@nestjs/swagger';
import { CreateTipoVisitaDto } from './create-tipo-visita.dto';

export class UpdateTipoVisitaDto extends PartialType(CreateTipoVisitaDto) {}

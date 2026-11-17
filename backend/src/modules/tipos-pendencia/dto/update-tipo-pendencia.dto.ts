import { PartialType } from '@nestjs/swagger';
import { CreateTipoPendenciaDto } from './create-tipo-pendencia.dto';

export class UpdateTipoPendenciaDto extends PartialType(CreateTipoPendenciaDto) {}

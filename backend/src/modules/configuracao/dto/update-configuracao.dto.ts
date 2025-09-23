import { PartialType } from '@nestjs/swagger';
import { CreateConfiguracaoDto } from './create-configuracao.dto';

export class UpdateConfiguracaoDto extends PartialType(CreateConfiguracaoDto) {}

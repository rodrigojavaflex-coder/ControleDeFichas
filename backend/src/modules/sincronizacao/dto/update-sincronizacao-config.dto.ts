import { PartialType } from '@nestjs/swagger';
import { CreateSincronizacaoConfigDto } from './create-sincronizacao-config.dto';

export class UpdateSincronizacaoConfigDto extends PartialType(CreateSincronizacaoConfigDto) {}

import { PartialType } from '@nestjs/mapped-types';
import { CreateFolhaTipoDto } from './create-folha-tipo.dto';

export class UpdateFolhaTipoDto extends PartialType(CreateFolhaTipoDto) {}

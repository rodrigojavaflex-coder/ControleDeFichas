import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsUUID,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class GerarArquivoPagamentoDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'IDs das folha_capa selecionadas para o arquivo.',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Selecione ao menos um funcionário.' })
  @IsUUID('4', { each: true })
  capaIds: string[];
}

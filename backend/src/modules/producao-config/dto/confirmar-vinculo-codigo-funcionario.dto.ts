import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsEnum, IsUUID } from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class ConfirmarVinculoCodigoFuncionarioDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({
    type: [String],
    description: 'IDs dos funcionários selecionados na prévia (somente elegíveis).',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  funcionarioIds: string[];
}

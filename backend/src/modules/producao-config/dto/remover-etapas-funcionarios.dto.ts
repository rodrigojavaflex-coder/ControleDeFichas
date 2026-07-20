import { ArrayMinSize, IsArray, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class RemoverEtapasFuncionariosDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({
    type: [String],
    description: 'IDs dos funcionários selecionados para remover todas as etapas configuradas',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID('4', { each: true })
  funcionarioIds: string[];
}

export class RemoverEtapasFuncionariosResponseDto {
  @ApiProperty()
  funcionariosAtualizados: number;
}

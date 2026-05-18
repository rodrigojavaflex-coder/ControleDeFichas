import { IsUUID, IsInt, Min, Max, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class CreateFolhaCapaDto {
  @ApiProperty()
  @IsUUID()
  funcionarioId: string;

  @ApiProperty({ enum: Unidade, description: 'Deve conferir com a unidade cadastrada do funcionário.' })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty()
  @IsInt()
  @Min(2000)
  ano: number;

  @ApiProperty()
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @ApiProperty()
  @IsUUID()
  folhaTipoId: string;
}

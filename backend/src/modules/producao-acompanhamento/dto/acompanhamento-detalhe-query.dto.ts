import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { AcompanhamentoUnidadesQueryDto } from './acompanhamento-unidades-query.dto';

export class AcompanhamentoDetalheQueryDto extends AcompanhamentoUnidadesQueryDto {
  @ApiProperty({ example: 'PESAGEM' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  codEtapa: string;
}

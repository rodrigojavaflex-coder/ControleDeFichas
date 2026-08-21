import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class FindVisitacaoAcompanhamentoDetalheDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty()
  @IsString()
  crmMedico: string;

  @ApiProperty({ example: 'GO' })
  @IsString()
  ufCrmMedico: string;

  @ApiProperty({ example: '2026-08-19' })
  @IsDateString(
    {},
    { message: 'Data inicial deve ter formato válido (YYYY-MM-DD)' },
  )
  dataInicial: string;

  @ApiProperty({ example: '2026-08-20' })
  @IsDateString(
    {},
    { message: 'Data final deve ter formato válido (YYYY-MM-DD)' },
  )
  dataFinal: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nomeMedico?: string;
}

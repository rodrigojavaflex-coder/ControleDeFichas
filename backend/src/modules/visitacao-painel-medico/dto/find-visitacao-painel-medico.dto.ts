import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class FindVisitacaoPainelMedicoDto {
  @ApiProperty({ minimum: 1, default: 1, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ minimum: 1, maximum: 200, default: 50, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsPositive()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiProperty({ enum: Unidade, required: false })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;

  @ApiProperty({ description: 'Nome do médico (parcial)', required: false })
  @IsOptional()
  @IsString()
  nomeMedico?: string;

  @ApiProperty({ description: 'CRM do médico (parcial)', required: false })
  @IsOptional()
  @IsString()
  crmMedico?: string;

  @ApiProperty({ description: 'UF do CRM', required: false, example: 'GO' })
  @IsOptional()
  @IsString()
  ufCrmMedico?: string;

  @ApiProperty({ description: 'Nome do representante (funcionário ou ERP)', required: false })
  @IsOptional()
  @IsString()
  nomeRepresentante?: string;

  @ApiProperty({
    description: 'Filtra pela carteira do funcionário vinculado ao painel',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  funcionarioId?: string;

  @ApiProperty({ description: 'Código do representante no painel', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  codigoRepresentante?: number;
}

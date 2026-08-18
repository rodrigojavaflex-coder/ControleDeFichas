import {
  IsOptional,
  IsString,
  IsNumber,
  Min,
  Max,
  IsEnum,
  IsBoolean,
  IsUUID,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class FindFuncionarioFolhaDto {
  @ApiPropertyOptional({
    enum: Unidade,
    description: 'Omitir para listar todas as unidades do escopo (RN-007).',
  })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nome?: string;

  @ApiPropertyOptional({ description: 'Filtra por cargo (folha_cargo.id).' })
  @IsOptional()
  @IsUUID()
  cargoId?: string;

  @ApiPropertyOptional({ description: 'Filtra por setor (folha_setor.id).' })
  @IsOptional()
  @IsUUID()
  setorId?: string;

  @ApiPropertyOptional({
    description:
      'Filtra por participação na folha de pagamento (participaFolhaPagamento).',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  })
  @IsBoolean()
  participaFolhaPagamento?: boolean;

  @ApiPropertyOptional({
    description: 'Retorna todos os registros (impressão), sem paginação.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  todos?: boolean;

  @ApiPropertyOptional({
    description: 'Inclui eventos fixos e verbas (impressão).',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  comEventosFixos?: boolean;
}

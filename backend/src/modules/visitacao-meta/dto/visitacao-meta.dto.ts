import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class FindVisitacaoMetaDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: 2026, description: 'Ano da competência' })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano: number;

  @ApiPropertyOptional({
    example: 8,
    description: 'Mês 1–12. Omitido = todos os meses do ano.',
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === '' || value == null) return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : value;
  })
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;
}

export class SalvarVisitacaoMetaDto {
  @ApiProperty()
  @IsUUID()
  funcionarioId: string;

  @ApiProperty({ example: '2026-08' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  anoMes: string;

  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorMeta: number;
}

export class CopiarVisitacaoMetaDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: '2026-07' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  anoMesOrigem: string;

  @ApiProperty({ example: '2026-08' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  anoMesDestino: string;
}

export class VisitacaoMetaItemDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  nome: string;

  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty({ example: '2026-08' })
  anoMes: string;

  @ApiProperty({ example: 8 })
  mes: number;

  @ApiPropertyOptional({ nullable: true })
  valorMeta: number | null;
}

export class VisitacaoMetaListResponseDto {
  @ApiProperty()
  unidade: Unidade;

  @ApiProperty()
  ano: number;

  @ApiPropertyOptional({ nullable: true, description: 'Nulo = todos os meses' })
  mes: number | null;

  @ApiProperty({ type: [VisitacaoMetaItemDto] })
  itens: VisitacaoMetaItemDto[];
}

export class CopiarVisitacaoMetaResponseDto {
  @ApiProperty()
  copiados: number;

  @ApiProperty({ type: VisitacaoMetaListResponseDto })
  lista: VisitacaoMetaListResponseDto;
}

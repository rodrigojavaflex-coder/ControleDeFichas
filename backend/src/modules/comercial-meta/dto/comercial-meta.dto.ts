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
import { ComercialTipoBase } from '../../../common/enums/comercial-tipo-base.enum';

export class FindComercialMetaDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano: number;

  @ApiPropertyOptional({ example: 8 })
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

export class SalvarComercialMetaDto {
  @ApiProperty()
  @IsUUID()
  funcionarioId: string;

  @ApiProperty({ example: '2026-08' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  anoMes: string;

  @ApiProperty({ enum: ComercialTipoBase })
  @IsEnum(ComercialTipoBase)
  tipoBase: ComercialTipoBase;

  @ApiProperty({ example: 50000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorMeta: number;
}

export class CopiarComercialMetaDto {
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

  @ApiPropertyOptional({
    example: 5,
    description: '% de aumento na meta de manipulados (0 = copia o valor).',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999.99)
  percentualAumentoRequisicao?: number;

  @ApiPropertyOptional({
    example: 3,
    description: '% de aumento na meta de marca própria (0 = copia o valor).',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999.99)
  percentualAumentoMarcaPropria?: number;
}

export class SalvarComercialMetaUnidadeDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: '2026-08' })
  @IsString()
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/)
  anoMes: string;

  @ApiProperty({ example: 150000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorMetaRequisicao: number;

  @ApiProperty({ example: 40000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorMetaMarcaPropria: number;
}

export class ComercialMetaItemDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  nome: string;

  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  codigoVendedorErp: number;

  @ApiProperty({ example: '2026-08' })
  anoMes: string;

  @ApiProperty({ example: 8 })
  mes: number;

  @ApiPropertyOptional({ nullable: true })
  valorMetaRequisicao: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorMetaMarcaPropria: number | null;
}

export class ComercialMetaListResponseDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  ano: number;

  @ApiPropertyOptional({ nullable: true })
  mes: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Meta da loja (Manipulados) da competência filtrada.',
  })
  metaUnidadeRequisicao: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Meta da loja (Marca própria) da competência filtrada.',
  })
  metaUnidadeMarcaPropria: number | null;

  @ApiProperty({ type: [ComercialMetaItemDto] })
  itens: ComercialMetaItemDto[];
}

export class CopiarComercialMetaResponseDto {
  @ApiProperty()
  copiados: number;

  @ApiProperty({ type: ComercialMetaListResponseDto })
  lista: ComercialMetaListResponseDto;
}

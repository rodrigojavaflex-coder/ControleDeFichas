import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Unidade } from '../../../common/enums/unidade.enum';

export class ProducaoJornadaIntervaloDto {
  @ApiProperty({ minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana: number;

  @ApiProperty()
  @IsInt()
  @Min(0)
  ordem: number;

  @ApiProperty({ example: '08:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  horaInicio: string;

  @ApiProperty({ example: '18:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}(:\d{2})?$/)
  horaFim: string;
}

export class ProducaoJornadaDiaDto {
  @ApiProperty({ minimum: 0, maximum: 6 })
  @IsInt()
  @Min(0)
  @Max(6)
  diaSemana: number;

  @ApiProperty()
  @IsBoolean()
  fechado: boolean;

  @ApiProperty({ type: [ProducaoJornadaIntervaloDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProducaoJornadaIntervaloDto)
  intervalos: ProducaoJornadaIntervaloDto[];
}

export class ProducaoJornadaResponseDto {
  @ApiProperty()
  configurado: boolean;

  @ApiProperty({ type: [ProducaoJornadaDiaDto] })
  dias: ProducaoJornadaDiaDto[];
}

export class SalvarProducaoJornadaDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ type: [ProducaoJornadaDiaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProducaoJornadaDiaDto)
  dias: ProducaoJornadaDiaDto[];
}

export class ProducaoFeriadoItemDto {
  @ApiProperty({ example: '2026-09-07' })
  data: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descricao?: string | null;

  @ApiProperty({ required: false, enum: ['manual', 'nacional'] })
  origem?: string;
}

export class ProducaoFeriadosMesResponseDto {
  @ApiProperty()
  ano: number;

  @ApiProperty({ required: false, nullable: true })
  mes?: number | null;

  @ApiProperty({ type: [ProducaoFeriadoItemDto] })
  feriados: ProducaoFeriadoItemDto[];
}

export class ProducaoFeriadoToggleDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: '2026-08-15' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  data: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  descricao?: string;
}

export class ImportarFeriadosNacionaisDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: 2026 })
  @IsInt()
  @Min(2000)
  @Max(2100)
  ano: number;
}

export class ImportarFeriadosNacionaisResponseDto {
  @ApiProperty()
  inseridos: number;

  @ApiProperty()
  ignorados: number;
}

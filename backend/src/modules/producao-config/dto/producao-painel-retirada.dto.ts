import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { Unidade } from '../../../common/enums/unidade.enum';
import {
  ProducaoPainelAlertaTipo,
} from '../entities/producao-painel-alerta-retirada.entity';

export class ProducaoPainelAlertaRetiradaDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  id?: string;

  @ApiProperty()
  @IsInt()
  @Min(0)
  ordem: number;

  @ApiProperty({ enum: ProducaoPainelAlertaTipo })
  @IsEnum(ProducaoPainelAlertaTipo)
  tipo: ProducaoPainelAlertaTipo;

  @ApiPropertyOptional({ description: 'Obrigatório quando tipo = ANTES' })
  @IsOptional()
  @IsInt()
  @Min(1)
  minutosAntes?: number | null;

  @ApiProperty({
    description: 'Cor em #RRGGBB, NEUTRO ou tokens legados (AMARELO, LARANJA, VERMELHO)',
    example: '#EAB308',
  })
  @IsString()
  @MaxLength(16)
  @Matches(/^(#[0-9A-Fa-f]{6}|NEUTRO|AMARELO|LARANJA|VERMELHO)$/)
  cor: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  rotulo?: string | null;
}

export class ProducaoPainelRetiradaConfigResponseDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty({ type: [String] })
  etapasFinalizacao: string[];

  @ApiProperty({ type: [ProducaoPainelAlertaRetiradaDto] })
  alertas: ProducaoPainelAlertaRetiradaDto[];
}

export class SalvarProducaoPainelRetiradaDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  etapasFinalizacao: string[];

  @ApiProperty({ type: [ProducaoPainelAlertaRetiradaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProducaoPainelAlertaRetiradaDto)
  alertas: ProducaoPainelAlertaRetiradaDto[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class BackfillPfcrmRetratosDto {
  @ApiProperty({
    description:
      'true = processa em lote preenchendo pfcrm vazio nos retratos; false = só conta pendências',
    default: false,
  })
  @IsBoolean()
  aplicar!: boolean;

  @ApiPropertyOptional({
    enum: Unidade,
    description: 'Filtra retratos pela unidade do fechamento; omitir = todas',
  })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;
}

export class BackfillPfcrmUnidadeResumoDto {
  @ApiProperty({ enum: Unidade })
  unidade!: Unidade;

  @ApiProperty({
    description:
      'Linhas de médico em todos os meses fechados da unidade (com ou sem PFCRM)',
  })
  medicosTotal!: number;

  @ApiProperty({
    description:
      'Linhas de carteira em todos os meses fechados da unidade (com ou sem PFCRM)',
  })
  carteiraTotal!: number;

  @ApiProperty()
  medicosSemPfcrm!: number;

  @ApiProperty()
  carteiraSemPfcrm!: number;

  @ApiProperty()
  medicosPreenchidos!: number;

  @ApiProperty()
  carteiraPreenchidos!: number;

  @ApiProperty()
  ambiguos!: number;

  @ApiProperty()
  semMatch!: number;

  @ApiProperty({
    description:
      'Quantidade resolvida via fallback PFCRM padrão (1=MEDICO) após nome/único falharem',
  })
  fallbackPadrao!: number;
}

export class BackfillPfcrmRetratosResponseDto {
  @ApiProperty()
  aplicar!: boolean;

  @ApiPropertyOptional({ nullable: true, enum: Unidade })
  unidadeFiltro!: Unidade | null;

  @ApiProperty({
    description:
      'Total de linhas de médico nos fechamentos do escopo (todos os meses fechados)',
  })
  medicosTotal!: number;

  @ApiProperty({
    description:
      'Total de linhas de carteira nos fechamentos do escopo (todos os meses fechados)',
  })
  carteiraTotal!: number;

  @ApiProperty()
  medicosSemPfcrm!: number;

  @ApiProperty()
  carteiraSemPfcrm!: number;

  @ApiProperty()
  medicosPreenchidos!: number;

  @ApiProperty()
  carteiraPreenchidos!: number;

  @ApiProperty()
  ambiguos!: number;

  @ApiProperty()
  semMatch!: number;

  @ApiProperty({
    description:
      'Linhas preenchidas com PFCRM padrão 1 (MEDICO) por dúvida após priorizar nome',
  })
  fallbackPadrao!: number;

  @ApiProperty({ type: [BackfillPfcrmUnidadeResumoDto] })
  porUnidade!: BackfillPfcrmUnidadeResumoDto[];

  @ApiProperty({ type: [String] })
  amostraFalhas!: string[];
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';
import { VisitacaoAcompanhamentoRecebidoUnidadeDto } from './visitacao-acompanhamento-recebido-unidade.dto';

export class FindVisitacaoAcompanhamentoMeuDto {
  @ApiPropertyOptional({
    example: 2026,
    description: 'Ano da competência (omitido = mês corrente SP).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2026)
  @Max(2033)
  ano?: number;

  @ApiPropertyOptional({
    example: 11,
    description: 'Mês 1–12 (omitido = mês corrente SP).',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;
}

/** Card do representante na home do app (RN-VIS-010). */
export class VisitacaoAcompanhamentoMeuCardDto {
  @ApiProperty()
  nomeRepresentante: string;

  @ApiPropertyOptional({ nullable: true })
  funcionarioId?: string | null;

  @ApiProperty()
  valorRecebido: number;

  @ApiProperty()
  quantidadeRecebido: number;

  @ApiProperty()
  valorRejeitado: number;

  @ApiProperty()
  quantidadeRejeitado: number;

  @ApiProperty()
  quantidadeMedicos: number;

  @ApiProperty()
  quantidadeMedicosPainel: number;

  @ApiProperty()
  quantidadeMedicosForaAtendimento: number;

  @ApiProperty()
  valorMarcaPropria: number;

  @ApiProperty()
  quantidadeMarcaPropria: number;

  @ApiPropertyOptional({
    nullable: true,
    description: '% do recebido do representante no caixa da unidade.',
  })
  representatividadePercentual?: number | null;

  @ApiPropertyOptional({ type: [VisitacaoAcompanhamentoRecebidoUnidadeDto] })
  recebidoPorUnidade?: VisitacaoAcompanhamentoRecebidoUnidadeDto[];

  @ApiPropertyOptional({ nullable: true })
  valorMeta?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualMeta?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorProjetado?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualProjecao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualComissaoFaixa?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorComissao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualComissaoFaixaProjetada?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorComissaoProjetado?: number | null;

  @ApiProperty()
  mesAberto: boolean;

  @ApiProperty({ description: 'Base oficial = requisições + marca própria.' })
  valorBaseOficial: number;
}

export class VisitacaoAcompanhamentoMeuHomeDto {
  @ApiProperty({
    description:
      'false quando o usuário não tem funcionário com representante do painel.',
  })
  disponivel: boolean;

  @ApiPropertyOptional({
    enum: ['sem_funcionario', 'sem_representante'],
    nullable: true,
  })
  motivo?: 'sem_funcionario' | 'sem_representante' | null;

  @ApiPropertyOptional({ enum: Unidade })
  unidade?: Unidade;

  @ApiPropertyOptional()
  ano?: number;

  @ApiPropertyOptional()
  mes?: number;

  @ApiPropertyOptional({ example: 'Novembro de 2026' })
  competenciaRotulo?: string;

  @ApiPropertyOptional({ enum: ['ABERTO', 'FECHADO'] })
  competenciaStatus?: 'ABERTO' | 'FECHADO';

  @ApiPropertyOptional({ nullable: true })
  dataUltimoCaixaFechado?: string | null;

  @ApiPropertyOptional({ nullable: true })
  diasUteisMes?: number | null;

  @ApiPropertyOptional({ nullable: true })
  diasRealizados?: number | null;

  @ApiPropertyOptional({ nullable: true })
  diasFaltam?: number | null;

  @ApiPropertyOptional({ type: VisitacaoAcompanhamentoMeuCardDto, nullable: true })
  card?: VisitacaoAcompanhamentoMeuCardDto | null;
}

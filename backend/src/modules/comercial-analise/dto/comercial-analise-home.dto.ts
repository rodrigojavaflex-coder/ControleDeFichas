import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';
import { ComercialAnalisePeriodoDto } from './comercial-analise-response.dto';

/** Destaque de Δ (crescimento/queda) no resumo da home. */
export class ComercialAnaliseHomeDestaqueDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  nomeVendedor: string;

  @ApiProperty({ description: 'Δ em R$ (semana atual − anterior).' })
  delta: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Δ %; null se a semana anterior for 0.',
  })
  percentual: number | null;

  @ApiProperty({ description: 'Valor (Total vendido) na semana atual.' })
  valorSemanaAtual: number;
}

/** Vendedor com maior rejeitado na semana atual (valor, não Δ). */
export class ComercialAnaliseHomeRejeitadoDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  nomeVendedor: string;

  @ApiProperty({ description: 'Valor rejeitado na semana atual.' })
  valor: number;
}

/** Card compacto por unidade (mesmo padrão visual do resumo da unidade). */
export class ComercialAnaliseHomeUnidadeCardDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiPropertyOptional({
    type: ComercialAnaliseHomeDestaqueDto,
    nullable: true,
  })
  maiorCrescimento: ComercialAnaliseHomeDestaqueDto | null;

  @ApiPropertyOptional({
    type: ComercialAnaliseHomeDestaqueDto,
    nullable: true,
  })
  maiorQueda: ComercialAnaliseHomeDestaqueDto | null;

  @ApiPropertyOptional({
    type: ComercialAnaliseHomeRejeitadoDto,
    nullable: true,
  })
  maiorRejeitado: ComercialAnaliseHomeRejeitadoDto | null;
}

/**
 * Resumo enxuto para o widget da home (RN-COM-009).
 * Sempre: modo semanas, base Total vendido, métrica valor, dimensão vendedor.
 * Escopo fixo → 1 card; sem unidade → um card por loja do enum.
 */
export class ComercialAnaliseHomeResponseDto {
  @ApiProperty({ type: ComercialAnalisePeriodoDto })
  semanaAtual: ComercialAnalisePeriodoDto;

  @ApiPropertyOptional({
    type: ComercialAnalisePeriodoDto,
    nullable: true,
    description: 'Null se o mês ainda não tem semana anterior para comparar.',
  })
  semanaAnterior: ComercialAnalisePeriodoDto | null;

  @ApiProperty({
    description: 'False quando não há semana anterior (não inventar Δ).',
  })
  temComparacao: boolean;

  @ApiProperty({ type: [ComercialAnaliseHomeUnidadeCardDto] })
  itens: ComercialAnaliseHomeUnidadeCardDto[];
}

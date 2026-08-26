import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class VisitacaoAcompanhamentoTotaisDto {
  @ApiProperty()
  valorRecebido: number;

  @ApiProperty()
  quantidadeRecebido: number;

  @ApiProperty()
  valorRejeitado: number;

  @ApiProperty()
  quantidadeRejeitado: number;

  @ApiProperty({ description: 'Quantidade de médicos (linhas) no filtro.' })
  quantidadeMedicos: number;

  @ApiPropertyOptional({
    description:
      'Soma das requisições do caixa (RN-VIS-008) no escopo da competência, sem exigir CRM.',
  })
  valorRecebidoCaixa?: number;

  @ApiPropertyOptional({
    description: 'Quantidade de requisições do caixa no escopo da competência.',
  })
  quantidadeRecebidoCaixa?: number;

  @ApiPropertyOptional({
    description: 'Médicos ativos no painel (carteira) do representante ou da unidade.',
  })
  quantidadeMedicosPainel?: number;

  @ApiPropertyOptional({
    description:
      'Médicos do painel sem recebido/rejeitado na competência (fora do atendimento).',
  })
  quantidadeMedicosForaAtendimento?: number;

  @ApiPropertyOptional({
    nullable: true,
    description: '% de comissão da faixa vigente (só com permissão).',
  })
  percentualComissaoFaixa?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Recebido × % da faixa (só com permissão).',
  })
  valorComissao?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Soma das metas cadastradas dos representantes vinculados.',
  })
  valorMeta?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Recebido / meta × 100. Nulo sem meta.',
  })
  percentualMeta?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Projeção: (recebido ÷ dias realizados) × dias úteis do mês.',
  })
  valorProjetado?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Projeção / meta × 100. Nulo sem meta ou sem projeção.',
  })
  percentualProjecao?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: '% de comissão da faixa pelo % da projeção (só com permissão).',
  })
  percentualComissaoFaixaProjetada?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Projeção × % da faixa projetada (só com permissão).',
  })
  valorComissaoProjetado?: number | null;

  @ApiPropertyOptional({ nullable: true })
  diasUteisMes?: number | null;

  @ApiPropertyOptional({ nullable: true })
  diasUteisDecorridos?: number | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'Dias úteis até o último caixa CONFIRMADO da unidade (Fechado ou Bloqueado).',
  })
  diasRealizados?: number | null;

  @ApiProperty()
  mesAberto: boolean;

  @ApiProperty({
    description: 'Representantes vinculados (com funcionarioId) no resultado.',
  })
  quantidadeRepresentantes: number;

  @ApiProperty({ description: 'Desses, quantos têm meta na competência.' })
  quantidadeComMeta: number;
}

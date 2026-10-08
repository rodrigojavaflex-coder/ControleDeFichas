import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class FindComercialAcompanhamentoDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2026)
  @Max(2033)
  ano: number;

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  funcionarioId?: string;
}

export class ComercialDesempenhoBaseDto {
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

  @ApiPropertyOptional({ nullable: true })
  diasUteisMes?: number | null;

  @ApiPropertyOptional({ nullable: true })
  diasRealizados?: number | null;

  @ApiPropertyOptional()
  mesAberto?: boolean;
}

export class ComercialAcompanhamentoItemDto extends ComercialDesempenhoBaseDto {
  @ApiPropertyOptional({ nullable: true })
  funcionarioId: string | null;

  @ApiProperty()
  nomeVendedor: string;

  @ApiPropertyOptional({ nullable: true })
  codigoVendedorErp: number | null;

  @ApiProperty()
  valorRecebidoRequisicao: number;

  @ApiProperty()
  quantidadeRecebidoRequisicao: number;

  @ApiProperty({
    description:
      'Linhas de fórmula no mesmo universo do card (itens REQUISICAO com pagamento + quantidade_formulas da paga sem item).',
  })
  quantidadeFormulasRequisicao: number;

  @ApiProperty({
    description: 'Parcela de Manipulados vinda só das requisições.',
  })
  valorRequisicaoPura: number;

  @ApiProperty({
    description:
      'Parcela de Manipulados vinda da revenda dos setores configurados.',
  })
  valorRevendaManipulados: number;

  @ApiProperty()
  quantidadeRevendaManipulados: number;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Setores de revenda que somam em Manipulados neste card.',
  })
  codigosSetorRevendaManipulados?: number[];

  @ApiProperty({
    description:
      'Baixas de vendas de terceiro. No vendedor: cruzamento cdVendedor × codigoVendedorErp. No TOTAL: todas as vendas da unidade.',
  })
  valorTerceirosManipulados: number;

  @ApiProperty({
    description: 'Vendas distintas com baixa no período.',
  })
  quantidadeTerceirosManipulados: number;

  @ApiProperty({
    description:
      'Base da comissão de Manipulados (requisições + setor, sem terceiros).',
  })
  valorComissaoBaseRequisicao: number;

  @ApiProperty()
  valorRecebidoMarcaPropria: number;

  @ApiProperty()
  quantidadeRecebidoMarcaPropria: number;

  @ApiProperty()
  valorRejeitado: number;

  @ApiProperty()
  quantidadeRejeitado: number;

  @ApiPropertyOptional({ nullable: true })
  valorMetaRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualMetaRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorProjetadoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualProjecaoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualComissaoFaixaRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorComissaoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorBonusRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorComissaoProjetadoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorBonusProjetadoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualComissaoFaixaProjetadoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorMetaMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualMetaMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorProjetadoMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualProjecaoMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualComissaoFaixaMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorComissaoMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorBonusMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorComissaoProjetadoMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorBonusProjetadoMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualComissaoFaixaProjetadoMarcaPropria?: number | null;
}

export class ComercialAcompanhamentoTotaisDto extends ComercialDesempenhoBaseDto {
  @ApiProperty()
  valorRecebidoRequisicao: number;

  @ApiProperty()
  quantidadeRecebidoRequisicao: number;

  @ApiProperty({
    description:
      'Soma das fórmulas dos vendedores vinculados (mesmo universo do card).',
  })
  quantidadeFormulasRequisicao: number;

  @ApiProperty({
    description: 'Soma das requisições dos vendedores (sem a revenda extra).',
  })
  valorRequisicaoPura: number;

  @ApiProperty({
    description:
      'Revenda dos setores da unidade que somam em Manipulados no TOTAL.',
  })
  valorRevendaManipulados: number;

  @ApiProperty()
  quantidadeRevendaManipulados: number;

  @ApiPropertyOptional({
    type: [Number],
    description: 'Setores de revenda da unidade que somam em Manipulados.',
  })
  codigosSetorRevendaManipulados?: number[];

  @ApiProperty({
    description:
      'Baixas de vendas de terceiro (`baixas` × `vendas`) da unidade no período até o último caixa confirmado.',
  })
  valorTerceirosManipulados: number;

  @ApiProperty()
  quantidadeTerceirosManipulados: number;

  @ApiProperty({
    description:
      'Requisições + setor da loja, sem terceiros — base do valor da comissão.',
  })
  valorComissaoBaseRequisicao: number;

  @ApiProperty()
  valorRecebidoMarcaPropria: number;

  @ApiProperty()
  quantidadeRecebidoMarcaPropria: number;

  @ApiPropertyOptional({
    type: [Number],
    description:
      'Setores da marca própria da loja. Vazio = card TOTAL não exibe o recorte.',
  })
  codigosSetorMarcaPropria?: number[];

  @ApiPropertyOptional({
    description:
      'Volume de marca própria da loja filtrado pelos setores da unidade.',
  })
  valorRecebidoMarcaPropriaSetores?: number;

  @ApiPropertyOptional()
  quantidadeRecebidoMarcaPropriaSetores?: number;

  @ApiProperty()
  valorRejeitado: number;

  @ApiProperty()
  quantidadeRejeitado: number;

  @ApiProperty()
  quantidadeVendedores: number;

  @ApiPropertyOptional({ nullable: true })
  valorMetaRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualMetaRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorMetaMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualMetaMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorProjetadoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualProjecaoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorProjetadoMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualProjecaoMarcaPropria?: number | null;
}

export class ComercialAcompanhamentoListResponseDto {
  @ApiProperty({ type: [ComercialAcompanhamentoItemDto] })
  itens: ComercialAcompanhamentoItemDto[];

  @ApiProperty({ type: ComercialAcompanhamentoTotaisDto })
  totais: ComercialAcompanhamentoTotaisDto;

  @ApiProperty()
  anoMes: string;

  @ApiProperty()
  dataInicial: string;

  @ApiProperty()
  dataFinal: string;
}

export class ComercialAcompanhamentoVendedorOpcaoDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  nome: string;

  @ApiProperty()
  codigoVendedorErp: number;
}

export class FindComercialAcompanhamentoDetalheDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2026)
  @Max(2033)
  ano: number;

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @ApiPropertyOptional({
    description: 'Omite para o detalhe do card TOTAL da unidade.',
  })
  @IsOptional()
  @IsUUID()
  funcionarioId?: string;
}

export class ComercialAcompanhamentoMovimentoRequisicaoDto {
  @ApiProperty()
  data: string;

  @ApiProperty()
  numeroCupom: number;

  @ApiProperty()
  numeroRequisicao: number;

  @ApiProperty()
  valor: number;
}

export class ComercialAcompanhamentoMovimentoProdutoDto {
  @ApiProperty()
  data: string;

  @ApiProperty()
  numeroCupom: number;

  @ApiPropertyOptional({ nullable: true })
  descricaoItem?: string | null;

  @ApiProperty()
  quantidade: number;

  @ApiProperty()
  valor: number;
}

export class ComercialAcompanhamentoMovimentoSetorDto {
  @ApiProperty()
  data: string;

  @ApiProperty()
  numeroCupom: number;

  @ApiPropertyOptional({ nullable: true })
  descricaoItem?: string | null;

  @ApiPropertyOptional({ nullable: true })
  codigoSetor?: number | null;

  @ApiProperty()
  quantidade: number;

  @ApiProperty()
  valor: number;
}

export class ComercialAcompanhamentoMovimentoRejeitadoDto {
  @ApiProperty()
  dataOrcamento: string;

  @ApiProperty()
  nrOrcamento: string;

  @ApiPropertyOptional({ nullable: true })
  nomeCliente?: string | null;

  @ApiProperty()
  precoVenda: number;

  @ApiPropertyOptional({ nullable: true })
  motivoRejeicao?: string | null;
}

export class ComercialAcompanhamentoMovimentoTerceiroDto {
  @ApiProperty({ description: 'Data da baixa (YYYY-MM-DD).' })
  dataBaixa: string;

  @ApiProperty()
  protocolo: string;

  @ApiPropertyOptional({ nullable: true })
  dataVenda?: string | null;

  @ApiPropertyOptional({ nullable: true })
  nomeCliente?: string | null;

  @ApiProperty({
    description: 'Valor da baixa no período (não é o valorPago da venda).',
  })
  valor: number;
}

export class ComercialAcompanhamentoDetalheDto {
  @ApiPropertyOptional({ nullable: true })
  funcionarioId: string | null;

  @ApiProperty()
  nomeVendedor: string;

  @ApiPropertyOptional({ nullable: true })
  codigoVendedorErp: number | null;

  @ApiProperty({ description: 'True no detalhe do card TOTAL da unidade.' })
  isTotal: boolean;

  @ApiProperty({ type: [ComercialAcompanhamentoMovimentoRequisicaoDto] })
  manipulados: ComercialAcompanhamentoMovimentoRequisicaoDto[];

  @ApiProperty({
    type: [ComercialAcompanhamentoMovimentoSetorDto],
    description:
      'Revenda dos setores que somam em Manipulados (política REQUISICAO), até o último caixa CONFIRMADO.',
  })
  setor: ComercialAcompanhamentoMovimentoSetorDto[];

  @ApiProperty({ type: [ComercialAcompanhamentoMovimentoProdutoDto] })
  marcaPropria: ComercialAcompanhamentoMovimentoProdutoDto[];

  @ApiProperty({ type: [ComercialAcompanhamentoMovimentoRejeitadoDto] })
  rejeitados: ComercialAcompanhamentoMovimentoRejeitadoDto[];

  @ApiProperty({
    type: [ComercialAcompanhamentoMovimentoTerceiroDto],
    description:
      'Baixas de terceiros do vendedor no período até o último caixa CONFIRMADO.',
  })
  terceiros: ComercialAcompanhamentoMovimentoTerceiroDto[];
}

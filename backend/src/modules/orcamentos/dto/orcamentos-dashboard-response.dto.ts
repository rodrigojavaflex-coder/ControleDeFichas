import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';
import { OrcamentoStatus } from '../../../common/enums/orcamento-status.enum';
import { OrcamentoMedicoOpcaoDto } from './orcamento-medico-opcao.dto';

export class DashboardSerieDto {
  @ApiProperty()
  name: string;

  @ApiProperty({ type: [Number] })
  data: number[];
}

export class DashboardKpiVolumeDto {
  @ApiProperty()
  quantidade: number;

  @ApiProperty()
  valor: number;
}

export class DashboardKpiTaxaConversaoDto {
  @ApiProperty()
  percentual: number;

  @ApiProperty()
  quantidadeAprovada: number;

  @ApiProperty()
  quantidadeTotal: number;
}

export class DashboardKpisDto {
  @ApiProperty({ type: DashboardKpiVolumeDto })
  volumeTotal: DashboardKpiVolumeDto;

  @ApiProperty({ type: DashboardKpiTaxaConversaoDto })
  taxaConversao: DashboardKpiTaxaConversaoDto;

  @ApiProperty({ type: DashboardKpiVolumeDto })
  receitaAprovada: DashboardKpiVolumeDto;

  @ApiProperty({ type: DashboardKpiVolumeDto })
  valorPerdido: DashboardKpiVolumeDto;
}

export class DashboardEvolucaoTemporalDto {
  @ApiProperty({ enum: ['dia', 'mes'] })
  granularidade: 'dia' | 'mes';

  @ApiProperty({ type: [String] })
  labels: string[];

  @ApiProperty({ type: [DashboardSerieDto] })
  series: DashboardSerieDto[];
}

export class DashboardVendedorDetalheDto {
  @ApiProperty({ required: false, nullable: true })
  nomeVendedor: string | null;

  @ApiProperty()
  quantidadeTotal: number;

  @ApiProperty()
  quantidadeAprovada: number;

  @ApiProperty()
  quantidadeRejeitada: number;

  @ApiProperty()
  valorAprovado: number;

  @ApiProperty()
  taxaConversao: number;
}

export class DashboardPerformanceVendedorDto {
  @ApiProperty()
  top: number;

  @ApiProperty({ type: [String] })
  labels: string[];

  @ApiProperty({ type: [DashboardSerieDto] })
  series: DashboardSerieDto[];

  @ApiProperty({ type: [DashboardVendedorDetalheDto] })
  detalhes: DashboardVendedorDetalheDto[];
}

export class DashboardUnidadePerformanceDetalheDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  quantidadeTotal: number;

  @ApiProperty()
  quantidadeAprovada: number;

  @ApiProperty()
  quantidadeRejeitada: number;

  @ApiProperty()
  valorAprovado: number;

  @ApiProperty()
  taxaConversao: number;
}

export class DashboardPerformanceUnidadeDto {
  @ApiProperty({ type: [String] })
  labels: string[];

  @ApiProperty({ type: [DashboardSerieDto] })
  series: DashboardSerieDto[];

  @ApiProperty({ type: [DashboardUnidadePerformanceDetalheDto] })
  detalhes: DashboardUnidadePerformanceDetalheDto[];
}

export class DashboardMedicoPerformanceDetalheDto {
  @ApiProperty({ required: false, nullable: true })
  nomeMedico: string | null;

  @ApiProperty()
  quantidadeTotal: number;

  @ApiProperty()
  quantidadeAprovada: number;

  @ApiProperty()
  quantidadeRejeitada: number;

  @ApiProperty()
  valorAprovado: number;

  @ApiProperty()
  taxaConversao: number;
}

export class DashboardPerformanceMedicoDto {
  @ApiProperty()
  top: number;

  @ApiProperty({ type: [String] })
  labels: string[];

  @ApiProperty({ type: [DashboardSerieDto] })
  series: DashboardSerieDto[];

  @ApiProperty({ type: [DashboardMedicoPerformanceDetalheDto] })
  detalhes: DashboardMedicoPerformanceDetalheDto[];
}

export class DashboardParetoItemDto {
  @ApiProperty({ required: false, nullable: true })
  motivoRejeicaoId: string | null;

  @ApiProperty()
  descricao: string;

  @ApiProperty()
  quantidade: number;

  @ApiProperty()
  valorPerdido: number;

  @ApiProperty()
  percentualAcumuladoQuantidade: number;

  @ApiProperty()
  percentualAcumuladoValor: number;
}

export class DashboardAnalisePerdasDto {
  @ApiProperty({ type: [String] })
  labels: string[];

  @ApiProperty({ type: [DashboardSerieDto] })
  series: DashboardSerieDto[];

  @ApiProperty({ type: [DashboardParetoItemDto] })
  pareto: DashboardParetoItemDto[];
}

export class DashboardFiltrosAplicadosDto {
  @ApiProperty({ required: false, nullable: true })
  dataInicial?: string | null;

  @ApiProperty({ required: false, nullable: true })
  dataFinal?: string | null;

  @ApiProperty({ enum: Unidade, isArray: true })
  unidades: Unidade[];

  @ApiProperty({ type: [String] })
  nomesVendedor: string[];

  @ApiProperty({ type: [String] })
  nomesMedico: string[];

  @ApiProperty({ enum: OrcamentoStatus, isArray: true })
  status: OrcamentoStatus[];

  @ApiProperty({ enum: ['dia', 'mes'] })
  granularidadeTemporal: 'dia' | 'mes';

  @ApiProperty()
  topVendedores: number;

  @ApiProperty({ description: 'Unidade fixa do usuário ou ALL' })
  escopoUnidade: Unidade | 'ALL';

  @ApiProperty({
    description: 'Indica se o usuário pode visualizar valores monetários no painel',
  })
  visualizarValores: boolean;
}

export class DashboardMetaDto {
  @ApiProperty({ example: 'precoVenda' })
  campoValor: string;

  @ApiProperty({ example: 'dataOrcamento' })
  campoData: string;

  @ApiProperty()
  geradoEm: string;
}

export class OrcamentosDashboardIndicadoresDto {
  @ApiProperty({ type: DashboardFiltrosAplicadosDto })
  filtrosAplicados: DashboardFiltrosAplicadosDto;

  @ApiProperty({ type: DashboardKpisDto })
  kpis: DashboardKpisDto;

  @ApiProperty({ type: DashboardEvolucaoTemporalDto })
  evolucaoTemporal: DashboardEvolucaoTemporalDto;

  @ApiProperty({ type: DashboardPerformanceVendedorDto })
  performanceVendedor: DashboardPerformanceVendedorDto;

  @ApiProperty({ type: DashboardPerformanceUnidadeDto })
  performanceUnidade: DashboardPerformanceUnidadeDto;

  @ApiProperty({ type: DashboardPerformanceMedicoDto })
  performanceMedico: DashboardPerformanceMedicoDto;

  @ApiProperty({ type: DashboardAnalisePerdasDto })
  analisePerdas: DashboardAnalisePerdasDto;

  @ApiProperty({ type: DashboardMetaDto })
  meta: DashboardMetaDto;
}

export class OrcamentosDashboardOpcoesFiltroDto {
  @ApiProperty({ type: [String] })
  nomesVendedor: string[];

  @ApiProperty({ type: [OrcamentoMedicoOpcaoDto] })
  medicos: OrcamentoMedicoOpcaoDto[];
}

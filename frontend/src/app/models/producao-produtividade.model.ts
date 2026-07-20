import { Unidade } from './usuario.model';

export interface ProdutividadeEtapaRow {
  codEtapa: string;
  etapa: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface ProdutividadeFuncionarioRow {
  funcionarioId: string;
  unidades: Unidade[];
  nome: string;
  codigoFuncionarioErp: number;
  codigosFuncionarioErp?: number[];
  setor: string | null;
  cargo: string | null;
  totalQuantidade: number;
  totalValor: number;
  etapas: ProdutividadeEtapaRow[];
}

export interface ProdutividadeResumo {
  linhasResumo: number;
  linhasContabilizadas: number;
  linhasSemFuncionario: number;
  linhasEtapaNaoConfigurada: number;
  totalQuantidade: number;
  totalValor: number;
  totalFuncionarios: number;
}

export interface ProdutividadeSemCadastroUnidade {
  unidade: Unidade;
  linhas: number;
}

export interface ProdutividadeFuncionarioSemCadastro {
  codigoErp: number;
  nome: string;
  unidades: ProdutividadeSemCadastroUnidade[];
  totalLinhas: number;
}

export interface ProdutividadeEtapaNaoVinculada {
  codEtapa: string;
  etapa: string;
  linhas: number;
}

export interface ProdutividadeFuncionarioSemEtapaVinculada {
  codigoErp: number;
  funcionarioId: string;
  nome: string;
  unidades: ProdutividadeSemCadastroUnidade[];
  etapas: ProdutividadeEtapaNaoVinculada[];
  totalLinhas: number;
}

export interface ProdutividadeAvisos {
  totalLinhasSemCadastro: number;
  funcionariosSemCadastro: ProdutividadeFuncionarioSemCadastro[];
  funcionariosSemCadastroOcultos: number;
  totalLinhasSemEtapaVinculada: number;
  funcionariosSemEtapaVinculada: ProdutividadeFuncionarioSemEtapaVinculada[];
  funcionariosSemEtapaVinculadaOcultos: number;
}

export interface ProdutividadeConsultaResponse {
  unidades: Unidade[];
  dataInicio: string;
  dataFim: string;
  resumo: ProdutividadeResumo;
  avisos: ProdutividadeAvisos;
  funcionarios: ProdutividadeFuncionarioRow[];
}

export interface ProdutividadeQuery {
  unidades: Unidade[];
  dataInicio: string;
  dataFim: string;
}

export type ProdutividadeTipoRelatorio = 'resumida' | 'sintetico' | 'analitico';

export interface ProdutividadeTipoRelatorioOpcao {
  value: ProdutividadeTipoRelatorio;
  label: string;
}

export const PRODUTIVIDADE_TIPOS_RELATORIO: ProdutividadeTipoRelatorioOpcao[] = [
  { value: 'resumida', label: 'Tabela Resumida' },
  { value: 'sintetico', label: 'Sintético' },
  { value: 'analitico', label: 'Analítico' },
];

export interface ProdutividadeAnaliticoLinha {
  funcionarioId: string;
  funcionario: string;
  unidade: Unidade;
  codEtapa: string;
  etapa: string;
  requisicao: number;
  formula: string;
  data: string;
}

export interface ProdutividadeAnaliticoResponse {
  unidades: Unidade[];
  dataInicio: string;
  dataFim: string;
  linhas: ProdutividadeAnaliticoLinha[];
}

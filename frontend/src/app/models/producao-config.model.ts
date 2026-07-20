import { Unidade } from './usuario.model';

export interface ProducaoEtapaRemuneracaoRow {
  codEtapa: string;
  etapa: string;
  posicaoEtapa: number;
  recebe: boolean;
  valor: number;
}

export interface ProducaoFuncionarioConfigRow {
  id: string;
  nome: string;
  codigoFuncionarioErp: number | null;
  setor: string | null;
  cargo: string | null;
  dataDemissao: string | null;
  desligado: boolean;
  qtdEtapasConfiguradas: number;
}

export interface ProducaoFuncionarioEtapaModalRow {
  codEtapa: string;
  etapa: string;
  posicaoEtapa: number;
  etapaRemunerada: boolean;
  valor: number;
  recebe: boolean;
}

export interface BulkSaveProducaoEtapasDto {
  unidade: Unidade;
  itens: ProducaoEtapaRemuneracaoRow[];
}

export interface BulkSaveProducaoFuncionarioEtapasDto {
  unidade: Unidade;
  itens: { codEtapa: string; recebe: boolean }[];
}

export type FiltroEtapasRecebe = 'todas' | 'recebe' | 'nao_recebe';

export type FiltroFuncionarioEtapas = 'todas' | 'com_etapas' | 'sem_etapas';

export type VinculoCodigoFuncionarioSituacao =
  | 'PREENCHER'
  | 'OK_JA_CORRETO'
  | 'CONFLITO_CODIGO_DIFERENTE'
  | 'MULTIPLOS_FUNCIONARIOS_MESMO_NOME'
  | 'MULTIPLOS_COD_ERP_MESMO_FUNCIONARIO'
  | 'MULTIPLOS_NOMES_MESMO_COD_ERP';

export interface VinculoCodigoFuncionarioPreviewRow {
  funcionarioId: string;
  funcionarioNome: string;
  funcSaidaErp: string;
  codigoErp: number;
  codigoAtual: number | null;
  situacao: VinculoCodigoFuncionarioSituacao;
  atualizavel: boolean;
}

export interface VinculoCodigoFuncionarioPreviewResumo {
  totalErp: number;
  totalPreencher: number;
  totalOk: number;
  totalConflitos: number;
  totalAmbiguos: number;
  totalErpSemFuncionario: number;
}

export interface VinculoCodigoFuncionarioPreviewResponse {
  itens: VinculoCodigoFuncionarioPreviewRow[];
  resumo: VinculoCodigoFuncionarioPreviewResumo;
  erpSemFuncionario: string[];
}

export interface VinculoCodigoFuncionarioConfirmResponse {
  atualizados: number;
  itens: VinculoCodigoFuncionarioPreviewRow[];
}

export interface ConfirmarVinculoCodigoFuncionarioDto {
  unidade: Unidade;
  funcionarioIds: string[];
}

export interface ProducaoConfigRelatorioEtapa {
  codEtapa: string;
  etapa: string;
  posicaoEtapa: number;
  valor: number;
}

export interface ProducaoConfigRelatorioFuncionarioEtapa {
  codEtapa: string;
  etapa: string;
}

export interface ProducaoConfigRelatorioFuncionario {
  id: string;
  nome: string;
  setor: string | null;
  cargo: string | null;
  codigoFuncionarioErp: number;
  desligado: boolean;
  dataDemissao: string | null;
  etapas: ProducaoConfigRelatorioFuncionarioEtapa[];
}

export interface ProducaoConfigRelatorio {
  unidade: Unidade;
  etapasRemuneradas: ProducaoConfigRelatorioEtapa[];
  funcionarios: ProducaoConfigRelatorioFuncionario[];
}

export interface AplicarEtapasRemuneradasResponse {
  funcionariosAtualizados: number;
  etapasAplicadas: number;
}

export interface RemoverEtapasFuncionariosResponse {
  funcionariosAtualizados: number;
}

export interface AplicarEtapasRemuneradasDto {
  unidade: Unidade;
  funcionarioIds: string[];
}

export interface RemoverEtapasFuncionariosDto {
  unidade: Unidade;
  funcionarioIds: string[];
}

export type AcaoEtapasFuncionariosModal = 'aplicar' | 'remover';

/** Linha editável na grid de etapas (UI). */
export interface ProducaoEtapaEditRow extends ProducaoEtapaRemuneracaoRow {
  valorDisplay: string;
  dirty?: boolean;
}

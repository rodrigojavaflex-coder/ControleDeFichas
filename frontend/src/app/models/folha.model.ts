import { Unidade } from './usuario.model';
import { PaginatedResponse } from './usuario.model';

/** Alinhado ao enum `TipoChavePixFolha` da API (strings estáveis). */
export enum TipoChavePixFolha {
  CPF = 'CPF',
  TELEFONE = 'TELEFONE',
  EMAIL = 'EMAIL',
  CHAVE_ALEATORIA = 'CHAVE_ALEATORIA',
}

export enum FolhaMovimentoTipo {
  RECEITA = 'RECEITA',
  DESPESA = 'DESPESA',
}

export interface FolhaCadastroSimples {
  id: string;
  descricao: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface FuncionarioFolha {
  id: string;
  nome: string;
  unidade: Unidade;
  cpf?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  email?: string | null;
  dataNascimento?: string | null;
  dataAdmissao?: string | null;
  dataDemissao?: string | null;
  cargoId?: string | null;
  setorId?: string | null;
  cargo?: FolhaCadastroSimples | null;
  setor?: FolhaCadastroSimples | null;
  ativo: boolean;
  tipoPix?: TipoChavePixFolha | null;
  chavePix?: string | null;
  criadoEm: string;
  atualizadoEm: string;
  /** Eventos padrão copiados na primeira geração da capa mensal (RN-013). */
  eventosFixos?: FolhaFuncionarioEventoFixo[];
}

export interface FolhaVerba {
  id: string;
  descricao: string;
  tipoMovimento: FolhaMovimentoTipo;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

/** Eventos padrão do funcionário (`folha_funcionario_evento_fixo`). */
export interface FolhaFuncionarioEventoFixo {
  id: string;
  folhaVerba: FolhaVerba;
  valor: string;
  quantidade: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface FolhaTipo {
  id: string;
  descricao: string;
  ativo: boolean;
  ordenacao: number;
  /** Tipos marcados como mensais usam carga em massa na competência (ver API). */
  folhaMensal?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface FolhaCapa {
  id: string;
  ano: number;
  mes: number;
  folhaTipo: FolhaTipo;
  funcionario: FuncionarioFolha;
  itens?: FolhaItem[];
  /** Capa congelada: sem edição de itens nem PATCH do funcionário até liberar. */
  congelada?: boolean;
  congeladaEm?: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface FolhaItem {
  id: string;
  valor: string;
  /** Referência / quantidade (decimal na API). */
  quantidade?: string;
  folhaVerba: FolhaVerba;
  criadoEm: string;
  atualizadoEm: string;
}

export interface FolhaCapaDetalheResponse {
  capa: FolhaCapa;
  totalReceitas: number;
  totalDespesas: number;
  liquido: number;
}

export interface FolhaFechamentoStatus {
  fechado: boolean;
  fechadoEm: string | null;
  id: string | null;
  /** Linha em `folha_fechamento` (abertura registrada na API). */
  registrada: boolean;
}

export type FolhaCompetenciaSituacaoGrid =
  | 'NAO_REGISTRADA'
  | 'ABERTA'
  | 'FECHADA';

export interface FolhaCompetenciaGridRow {
  unidade: Unidade;
  mes: number;
  folhaTipoId: string;
  folhaTipoDescricao: string;
  situacao: FolhaCompetenciaSituacaoGrid;
  fechamentoId: string | null;
  fechadoEm: string | null;
  /** ISO; momento da abertura vigente na API (registro inicial ou última reabertura). */
  abertaEm: string | null;
}

export type FuncionarioPaginated = PaginatedResponse<FuncionarioFolha>;

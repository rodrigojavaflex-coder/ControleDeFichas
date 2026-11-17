export type StatusVisita = 'ABERTA' | 'CONCLUIDA' | 'PENDENCIA_ABERTA';

export type FiltroPainelVisita = 'todos' | 'no_painel' | 'fora_painel';

export interface TipoVisitaOpcao {
  id: string;
  nome: string;
}

export interface MedicoCarteira {
  prescritorId: string | null;
  nome: string;
  crm: string;
  uf: string;
  pfcrm: string | null;
  profissao: string;
  noPainel: boolean;
  diasSemVisita: number | null;
  rotuloDias: string;
  podeIniciar: boolean;
}

export interface HistoricoVisita {
  id: string;
  status: StatusVisita;
  prescritorNome: string;
  crm: string;
  uf: string;
  tipoVisitaNome: string;
  dataHoraInicio: string;
  dataHoraFim: string | null;
  noPainel: boolean;
  diasDesdeVisita: number;
  rotuloDias: string;
}

export type PeriodoHistoricoModo = 'ano' | 'mes' | 'personalizado';

export interface PeriodoHistoricoFiltro {
  periodo: PeriodoHistoricoModo;
  ano?: number;
  mes?: number;
  dataInicio?: string;
  dataFim?: string;
}

export type ComparacaoDiasHistorico = 'mais' | 'menos';

export interface FiltroDiasHistorico {
  comparacao: ComparacaoDiasHistorico;
  dias: number;
}

export interface VisitaCorDiaAtiva {
  diasAcimaDe: number;
  cor: string;
  ativo?: boolean;
}

export function corPorDias(
  dias: number,
  faixas: VisitaCorDiaAtiva[],
): string | null {
  let escolhida: VisitaCorDiaAtiva | null = null;
  for (const faixa of faixas) {
    if (faixa.ativo === false) continue;
    if (
      dias > faixa.diasAcimaDe &&
      (!escolhida || faixa.diasAcimaDe > escolhida.diasAcimaDe)
    ) {
      escolhida = faixa;
    }
  }
  return escolhida?.cor ?? null;
}

export function textoSobreCor(hex: string): string {
  const n = hex.replace('#', '');
  if (!/^[0-9A-Fa-f]{6}$/.test(n)) return '#1e293b';
  const r = Number.parseInt(n.slice(0, 2), 16);
  const g = Number.parseInt(n.slice(2, 4), 16);
  const b = Number.parseInt(n.slice(4, 6), 16);
  const luminancia = (r * 299 + g * 587 + b * 114) / 1000;
  return luminancia >= 160 ? '#1e293b' : '#ffffff';
}

export interface VisitaResumo {
  id: string;
  status: StatusVisita;
  prescritorId: string;
  prescritorNome: string;
  crm: string;
  uf: string;
  tipoVisitaId: string;
  tipoVisitaNome: string;
  dataHoraInicio: string;
  dataHoraFim: string | null;
  descricao: string | null;
  pendencia: string | null;
  material: string | null;
  unidade: string;
  latitudeInicio?: number;
  longitudeInicio?: number;
}

export interface PainelOrcamentoItem {
  id: string;
  nrOrcamento: string;
  dataOrcamento: string;
  valor: number;
  status: 'APROVADO' | 'REJEITADO';
}

export interface PainelAtivoItem {
  nome: string;
  quantidade: number;
  valor: number;
}

export interface PainelHistoricoVisitaItem {
  id: string;
  data: string;
  dias: number | null;
  tipoVisitaNome: string;
  abordagem: string;
  status: StatusVisita;
}

export interface PainelPendenciaItem {
  id: string;
  visitaId: string | null;
  dataHoraInicio: string;
  tipoVisitaNome: string;
  pendencia: string;
  visitadorNome: string | null;
}

export interface PainelPrescritorVisita {
  visitaId: string;
  prescritorId: string;
  prescritorNome: string;
  crm: string;
  uf: string;
  unidade: string;
  competencia: string;
  latitudeInicio: number;
  longitudeInicio: number;
  pendencias: PainelPendenciaItem[];
  historicoVisitas: PainelHistoricoVisitaItem[];
  aprovados: {
    quantidade: number;
    valor: number;
    itens: PainelOrcamentoItem[];
  };
  rejeitados: {
    quantidade: number;
    valor: number;
    itens: PainelOrcamentoItem[];
  };
  ativosMaisAprovados: PainelAtivoItem[];
  ativosMaisRejeitados: PainelAtivoItem[];
}

export type TipoMidiaVisita = 'imagem' | 'audio';

export interface VisitaMidia {
  id: string;
  tipo: TipoMidiaVisita | 'documento';
  nomeArquivo: string;
  mimeType: string;
  tamanho: number;
  duracaoMs: number | null;
}

export interface CarteiraVisitas {
  vinculoOk: boolean;
  vinculoMensagem: string | null;
  unidade: string | null;
  painelDisponivel: boolean;
  filtroPainel: FiltroPainelVisita;
  tipos: TipoVisitaOpcao[];
  visitaAberta: VisitaResumo | null;
  medicos: MedicoCarteira[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  busca: string | null;
}

export interface CarteiraConsulta {
  filtroPainel?: FiltroPainelVisita | null;
  page?: number;
  limit?: number;
  busca?: string | null;
}

export interface MedicoPendenciaOpcao {
  id: string;
  nome: string;
  crm: string;
  uf: string;
}

export type StatusSolicitacao = 'ABERTA' | 'RESOLVIDA' | 'CONCLUIDA' | 'REABERTA';

export interface TipoPendenciaOpcao {
  id: string;
  nome: string;
  descricao: string;
  responsavelId: string;
  responsavelNome: string | null;
}

export type StatusFiltroPendencia = 'todas' | StatusSolicitacao;

export interface FiltroPendenciasApp {
  status?: StatusFiltroPendencia;
  tipoPendenciaId?: string | null;
  prescritorId?: string | null;
  filtroPainel?: FiltroPainelVisita;
  periodo?: PeriodoHistoricoFiltro | null;
  page?: number;
  limit?: number;
}

export interface SolicitacaoResumo {
  id: string;
  texto: string;
  status: StatusSolicitacao;
  visitaId: string | null;
  prescritorId: string | null;
  prescritorNome: string | null;
  crm: string | null;
  uf: string | null;
  visitadorId: string | null;
  visitadorNome: string | null;
  tipoPendenciaId: string | null;
  tipoPendenciaNome: string | null;
  responsavelId: string | null;
  responsavelNome: string | null;
  criadoEm: string;
  ultimaDescricao: string | null;
  noPainel?: boolean | null;
  diasAberta?: number | null;
  rotuloDias?: string | null;
}

export interface SolicitacoesListaPaginada {
  items: SolicitacaoResumo[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  painelDisponivel: boolean;
}

export interface SolicitacaoHistoricoItem {
  id: string;
  status: StatusSolicitacao;
  descricao: string;
  usuarioId: string | null;
  usuarioNome: string | null;
  criadoEm: string;
}

export function rotuloStatusVisita(status: StatusVisita): string {
  if (status === 'ABERTA') return 'Em andamento';
  if (status === 'PENDENCIA_ABERTA') return 'Pendência aberta';
  return 'Concluída';
}

export function formatarDataHoraVisita(iso: string | null): string {
  if (!iso) return '—';
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return '—';
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(data);
}

export function rotuloCrm(crm: string, uf: string): string {
  const numero = crm?.trim();
  const estado = uf?.trim();
  if (!numero && !estado) return '';
  if (!estado) return `CRM ${numero}`;
  if (!numero) return estado;
  return `CRM ${numero}/${estado}`;
}

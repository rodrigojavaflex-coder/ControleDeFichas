import { Unidade } from '../../common/enums/unidade.enum';
import { StatusVisita } from './enums/status-visita.enum';

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
  latitudeInicio: number;
  longitudeInicio: number;
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

export interface CarteiraVisitas {
  vinculoOk: boolean;
  vinculoMensagem: string | null;
  unidade: Unidade | null;
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

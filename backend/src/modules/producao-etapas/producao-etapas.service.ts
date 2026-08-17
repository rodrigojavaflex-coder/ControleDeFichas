import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProducaoEtapaResumo } from './entities/producao-etapa-resumo.entity';
import { Unidade } from '../../common/enums/unidade.enum';
import {
  normalizarTextoLegado,
  padronizarDescricaoLegado,
  padronizarNomeLegadoNullable,
} from '../../common/utils/encoding-legado.util';
import { formatarErroRespostaAgente } from '../../common/utils/formatar-erro-agente.util';

export interface AgenteProducaoEtapa {
  filial: number;
  requisicao: number;
  formula: string;
  cod_etapa: string;
  etapa: string;
  posicao_etapa: number;
  usuario_entrada?: number | null;
  usuario_saida?: number | null;
  funcionario_entrada?: number | null;
  funcionario_saida?: number | null;
  data_entrada?: string | null;
  hora_entrada?: string | null;
  data_saida?: string | null;
  hora_saida?: string | null;
  tempo_etapa?: number | null;
  forma_farmaceutica?: string | null;
  quantidade?: number | null;
  unidade_medida?: string | null;
  laboratorio?: string | null;
  tipo_formula?: string | null;
  qtd_principios_ativos: number;
  principios_ativos?: string | null;
  embalagem?: string | null;
  paciente?: string | null;
  codigo_cliente?: number | null;
  cliente?: string | null;
  crf?: string | null;
  uf_crf?: string | null;
  nome_prescritor?: string | null;
  data_retirada?: string | null;
  hora_retirada?: string | null;
  em_andamento_fila?: boolean;
  usuario_entrada_fila?: number | null;
  data_entrada_fila?: string | null;
  hora_entrada_fila?: string | null;
}

export interface ProducaoEtapasSyncResult {
  processados: number;
  criados: number;
  atualizados: number;
}

export interface AgenteProducaoExclusaoReceita {
  filial: number;
  requisicao: number;
  formula: string;
  data_exclusao: string;
  hora_exclusao?: string | null;
  cdusu?: number | null;
  motivo?: string | null;
  evento: string;
}

export interface ProducaoEtapasExclusaoResult {
  formulasProcessadas: number;
  linhasRemovidas: number;
}

export interface AgenteProducaoAlteracaoAgendamento {
  filial: number;
  requisicao: number;
  formula: string;
  data_alteracao: string;
  hora_alteracao?: string | null;
  cdusu?: number | null;
  evento: string;
  data_retirada: string | null;
  hora_retirada: string | null;
}

export interface ProducaoEtapasRetiradaAgendamentoResult {
  formulasProcessadas: number;
  linhasAtualizadas: number;
}

export type ProducaoEtapasProgressCallback = (
  stats: ProducaoEtapasSyncResult & { total: number },
) => void;

@Injectable()
export class ProducaoEtapasService {
  private readonly logger = new Logger(ProducaoEtapasService.name);

  private readonly agenteUnidadeMap: Record<string, Unidade> = {
    inhumas: Unidade.INHUMAS,
    uberaba: Unidade.UBERABA,
    neropolis: Unidade.NERÓPOLIS,
  };

  private readonly agenteCdfilMap: Record<string, number> = {
    inhumas: 2,
    uberaba: 2,
    neropolis: 4,
  };

  constructor(
    @InjectRepository(ProducaoEtapaResumo)
    private readonly etapaRepository: Repository<ProducaoEtapaResumo>,
  ) {}

  getUnidadePorAgente(agente: string): Unidade {
    const unidade = this.agenteUnidadeMap[agente];
    if (!unidade) {
      throw new Error(`Unidade não mapeada para o agente: ${agente}`);
    }
    return unidade;
  }

  getCdfilPorAgente(agente: string): number {
    const unit = this.agenteCdfilMap[agente];
    if (!unit) {
      throw new Error(`CDFIL não mapeado para o agente: ${agente}`);
    }
    return unit;
  }

  async buscarPeriodoDoAgente(
    url: string,
    token: string,
    unit: number,
    start: string,
    end: string,
    agente: string,
  ): Promise<AgenteProducaoEtapa[]> {
    return this.postAgenteEtapas(url, token, agente, {
      unit,
      start,
      end,
    });
  }

  async buscarIncrementalDoAgente(
    url: string,
    token: string,
    unit: number,
    dataMinimaMovimento: string,
    agente: string,
  ): Promise<AgenteProducaoEtapa[]> {
    return this.postAgenteEtapas(url, token, agente, {
      unit,
      dataMinimaMovimento,
    });
  }

  async buscarExclusoesReceitasDoAgente(
    url: string,
    token: string,
    unit: number,
    start: string,
    end: string,
    agente: string,
  ): Promise<AgenteProducaoExclusaoReceita[]> {
    const urlCompleta = `${url}/api/v1/producao/exclusoes-receitas`;
    this.logger.log(
      `[${agente}] Consultando exclusões RECEITAS: ${urlCompleta} (${start}..${end}, unit=${unit})`,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(urlCompleta, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ unit, start, end }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `[${agente}] exclusoes-receitas HTTP ${response.status}: ${errorText.slice(0, 500)}`,
        );
        throw new Error(
          formatarErroRespostaAgente(response.status, errorText),
        );
      }

      const data = (await response.json()) as {
        exclusoes?: AgenteProducaoExclusaoReceita[];
      };
      const exclusoes = data.exclusoes ?? [];
      this.logger.log(
        `[${agente}] Agente retornou ${exclusoes.length} exclusão(ões) confirmada(s) (FC12100 ausente)`,
      );
      return exclusoes;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timeout ao buscar exclusões do agente');
      }
      throw error;
    }
  }

  /** RN-PCP-008: remove todas as etapas da fórmula excluída no ERP (sem histórico local). */
  async aplicarExclusoesFormulas(
    unidade: Unidade,
    exclusoes: AgenteProducaoExclusaoReceita[],
    agente: string,
  ): Promise<ProducaoEtapasExclusaoResult> {
    const resultado: ProducaoEtapasExclusaoResult = {
      formulasProcessadas: 0,
      linhasRemovidas: 0,
    };

    const vistos = new Set<string>();
    for (const item of exclusoes) {
      const formula = this.normalizarFormulaImportacao(String(item.formula ?? ''));
      const key = `${Number(item.filial)}|${Number(item.requisicao)}|${formula}`;
      if (vistos.has(key)) {
        continue;
      }
      vistos.add(key);
      resultado.formulasProcessadas += 1;

      const deleteResult = await this.etapaRepository.delete({
        unidade,
        filial: Number(item.filial),
        requisicao: Number(item.requisicao),
        formula,
      });
      const afetadas = deleteResult.affected ?? 0;
      resultado.linhasRemovidas += afetadas;

      if (afetadas > 0) {
        this.logger.log(
          `[${agente}] Exclusão ERP: req.${item.requisicao} fórmula ${formula} — ${afetadas} linha(s) removida(s)${item.motivo ? ` (motivo: ${item.motivo})` : ''}`,
        );
      }
    }

    return resultado;
  }

  async buscarAlteracoesAgendamentoDoAgente(
    url: string,
    token: string,
    unit: number,
    start: string,
    end: string,
    agente: string,
  ): Promise<AgenteProducaoAlteracaoAgendamento[]> {
    const urlCompleta = `${url}/api/v1/producao/alteracoes-agendamento-receitas`;
    this.logger.log(
      `[${agente}] Consultando alterações AGENDAMENTO RECEITAS: ${urlCompleta} (${start}..${end}, unit=${unit})`,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(urlCompleta, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ unit, start, end }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `[${agente}] alteracoes-agendamento-receitas HTTP ${response.status}: ${errorText.slice(0, 500)}`,
        );
        throw new Error(
          formatarErroRespostaAgente(response.status, errorText),
        );
      }

      const data = (await response.json()) as {
        alteracoes?: AgenteProducaoAlteracaoAgendamento[];
      };
      const alteracoes = data.alteracoes ?? [];
      this.logger.log(
        `[${agente}] Agente retornou ${alteracoes.length} alteração(ões) AGENDAMENTO confirmada(s)`,
      );
      return alteracoes;
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timeout ao buscar alterações de agendamento do agente');
      }
      throw error;
    }
  }

  /** RN-PCP-012: atualiza data/hora de retirada em todas as etapas da fórmula. */
  async aplicarAlteracoesAgendamentoRetirada(
    unidade: Unidade,
    alteracoes: AgenteProducaoAlteracaoAgendamento[],
    agente: string,
  ): Promise<ProducaoEtapasRetiradaAgendamentoResult> {
    const resultado: ProducaoEtapasRetiradaAgendamentoResult = {
      formulasProcessadas: 0,
      linhasAtualizadas: 0,
    };

    const vistos = new Set<string>();
    for (const item of alteracoes) {
      const formula = this.normalizarFormulaImportacao(String(item.formula ?? ''));
      const key = `${Number(item.filial)}|${Number(item.requisicao)}|${formula}`;
      if (vistos.has(key)) {
        continue;
      }
      vistos.add(key);
      resultado.formulasProcessadas += 1;

      const patch: Partial<ProducaoEtapaResumo> = {};
      if (item.data_retirada?.trim()) {
        patch.dataRetirada = item.data_retirada.trim();
      }
      if (item.hora_retirada?.trim()) {
        patch.horaRetirada = item.hora_retirada.trim();
      }
      if (Object.keys(patch).length === 0) {
        continue;
      }

      const updateResult = await this.etapaRepository.update(
        {
          unidade,
          filial: Number(item.filial),
          requisicao: Number(item.requisicao),
          formula,
        },
        patch,
      );
      const afetadas = updateResult.affected ?? 0;
      resultado.linhasAtualizadas += afetadas;

      if (afetadas > 0) {
        this.logger.log(
          `[${agente}] RN-PCP-012: req.${item.requisicao} fórmula ${formula} — retirada ${patch.dataRetirada ?? '?'} ${patch.horaRetirada ?? ''} em ${afetadas} linha(s)`,
        );
      }
    }

    return resultado;
  }

  private async postAgenteEtapas(
    url: string,
    token: string,
    agente: string,
    body: Record<string, unknown>,
  ): Promise<AgenteProducaoEtapa[]> {
    return this.postAgente(url, token, agente, body);
  }

  private async postAgente(
    url: string,
    token: string,
    agente: string,
    body: Record<string, unknown>,
  ): Promise<AgenteProducaoEtapa[]> {
    const urlCompleta = `${url}/api/v1/producao/etapas-resumo`;

    this.logger.log(`[${agente}] Chamando agente produção: ${urlCompleta}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000);

    try {
      const response = await fetch(urlCompleta, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          formatarErroRespostaAgente(response.status, errorText),
        );
      }

      const data = (await response.json()) as { etapas?: AgenteProducaoEtapa[] };
      const etapas = data.etapas ?? [];
      this.logger.log(
        `[${agente}] Agente retornou ${etapas.length} etapa(s) (unit=${body.unit}, período=${body.start ?? body.dataMinimaMovimento}-${body.end ?? ''})`,
      );
      return etapas;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout ao buscar etapas do agente');
      }
      throw error;
    }
  }

  async processarLote(
    registros: AgenteProducaoEtapa[],
    unidade: Unidade,
    onProgress?: ProducaoEtapasProgressCallback,
  ): Promise<ProducaoEtapasSyncResult> {
    const resultado: ProducaoEtapasSyncResult = {
      processados: 0,
      criados: 0,
      atualizados: 0,
    };
    const deduplicados = this.deduplicarRegistrosPorChaveImportacao(registros);
    if (deduplicados.length < registros.length) {
      this.logger.warn(
        `Lote etapas: ${registros.length - deduplicados.length} linha(s) duplicada(s) por filial+req+formula+cod_etapa (ex.: tppcp distinto) — merge antes do upsert`,
      );
    }
    const total = deduplicados.length;

    for (const registro of deduplicados) {
      resultado.processados++;
      const foiCriado = await this.upsertRegistro(registro, unidade);
      if (foiCriado) {
        resultado.criados++;
      } else {
        resultado.atualizados++;
      }

      if (
        onProgress &&
        (resultado.processados === 1 ||
          resultado.processados === total ||
          resultado.processados % 50 === 0)
      ) {
        onProgress({ ...resultado, total });
      }
    }

    if (onProgress && total > 0) {
      onProgress({ ...resultado, total });
    }

    return resultado;
  }

  private normalizarFormulaImportacao(formula: string): string {
    const t = formula.trim();
    if (!t) return t;
    if (/^\d+$/.test(t)) return String(Number(t));
    return t;
  }

  private async upsertRegistro(
    registro: AgenteProducaoEtapa,
    unidade: Unidade,
  ): Promise<boolean> {
    const formula = this.normalizarFormulaImportacao(
      String(registro.formula ?? ''),
    );
    const codEtapa = String(registro.cod_etapa ?? '').trim();

    let etapa = await this.etapaRepository.findOne({
      where: {
        unidade,
        filial: Number(registro.filial ?? 0),
        requisicao: Number(registro.requisicao ?? 0),
        formula,
        codEtapa,
      },
    });

    const foiCriado = !etapa;
    const payload: Partial<ProducaoEtapaResumo> = {
      unidade,
      filial: Number(registro.filial ?? 0),
      requisicao: Number(registro.requisicao ?? 0),
      formula,
      codEtapa,
      etapa: padronizarDescricaoLegado(registro.etapa || ''),
      posicaoEtapa: Number(registro.posicao_etapa ?? 0),
      usuarioEntrada: registro.usuario_entrada ?? null,
      usuarioSaida: registro.usuario_saida ?? null,
      funcionarioEntrada: registro.funcionario_entrada ?? null,
      funcionarioSaida: registro.funcionario_saida ?? null,
      dataEntrada: registro.data_entrada || null,
      horaEntrada: registro.hora_entrada || null,
      dataSaida: registro.data_saida || null,
      horaSaida: registro.hora_saida || null,
      tempoEtapa:
        registro.tempo_etapa != null ? Number(registro.tempo_etapa) : null,
      formaFarmaceutica: normalizarTextoLegado(registro.forma_farmaceutica),
      quantidade:
        registro.quantidade != null ? Number(registro.quantidade) : null,
      unidadeMedida: normalizarTextoLegado(registro.unidade_medida),
      laboratorio: normalizarTextoLegado(registro.laboratorio),
      tipoFormula: normalizarTextoLegado(registro.tipo_formula),
      qtdPrincipiosAtivos: Number(registro.qtd_principios_ativos ?? 0),
      principiosAtivos: normalizarTextoLegado(registro.principios_ativos),
      embalagem: normalizarTextoLegado(registro.embalagem),
      paciente: padronizarNomeLegadoNullable(registro.paciente),
      codigoCliente:
        registro.codigo_cliente != null
          ? Number(registro.codigo_cliente)
          : null,
      cliente: padronizarNomeLegadoNullable(registro.cliente),
      crf: registro.crf?.trim() || null,
      ufCrf: registro.uf_crf?.trim() || null,
      nomePrescritor: padronizarNomeLegadoNullable(registro.nome_prescritor),
      dataRetirada: registro.data_retirada || null,
      horaRetirada: registro.hora_retirada || null,
      emAndamentoFila: Boolean(registro.em_andamento_fila),
      usuarioEntradaFila: registro.usuario_entrada_fila ?? null,
      dataEntradaFila: registro.data_entrada_fila || null,
      horaEntradaFila: registro.hora_entrada_fila || null,
    };

    if (!etapa) {
      etapa = this.etapaRepository.create(payload);
    } else {
      this.preservarFechamentoNoPayload(payload, etapa);
      Object.assign(etapa, payload);
    }

    await this.etapaRepository.save(etapa);
    return foiCriado;
  }

  /** Mesma chave do upsert (RN-PCP-001); o agente pode enviar várias linhas por `tppcp`. */
  private chaveRegistroImportacao(registro: AgenteProducaoEtapa): string {
    return [
      Number(registro.filial ?? 0),
      Number(registro.requisicao ?? 0),
      String(this.normalizarFormulaImportacao(String(registro.formula ?? ''))),
      String(registro.cod_etapa ?? '').trim(),
    ].join('|');
  }

  private codigoOperadorValido(cod: number | null | undefined): boolean {
    return cod != null && Number(cod) > 0;
  }

  private usuarioValido(cod: number | null | undefined): boolean {
    return this.codigoOperadorValido(cod);
  }

  private deduplicarRegistrosPorChaveImportacao(
    registros: AgenteProducaoEtapa[],
  ): AgenteProducaoEtapa[] {
    const map = new Map<string, AgenteProducaoEtapa>();
    for (const registro of registros) {
      const key = this.chaveRegistroImportacao(registro);
      const existente = map.get(key);
      map.set(
        key,
        existente
          ? this.mesclarRegistrosMesmaEtapa(existente, registro)
          : registro,
      );
    }
    return [...map.values()];
  }

  private mesclarRegistrosMesmaEtapa(
    a: AgenteProducaoEtapa,
    b: AgenteProducaoEtapa,
  ): AgenteProducaoEtapa {
    const entrada = this.escolherPrimeiroCronologico(a, b, 'entrada');
    const saida = this.escolherPrimeiroCronologico(a, b, 'saida');
    const fila = this.mesclarCamposFila(a, b);
    const posicao = Math.max(
      Number(a.posicao_etapa ?? 0),
      Number(b.posicao_etapa ?? 0),
    );
    const etapaNome =
      (a.etapa?.trim() ? a.etapa : b.etapa)?.trim() || a.etapa || b.etapa || '';

    return {
      ...a,
      ...b,
      etapa: etapaNome,
      posicao_etapa: posicao,
      usuario_entrada: entrada.usuario,
      funcionario_entrada: entrada.funcionario,
      data_entrada: entrada.data,
      hora_entrada: entrada.hora,
      usuario_saida: saida.usuario,
      funcionario_saida: saida.funcionario,
      data_saida: saida.data,
      hora_saida: saida.hora,
      tempo_etapa:
        a.tempo_etapa != null ? a.tempo_etapa : (b.tempo_etapa ?? null),
      em_andamento_fila: fila.em_andamento_fila,
      usuario_entrada_fila: fila.usuario_entrada_fila,
      data_entrada_fila: fila.data_entrada_fila,
      hora_entrada_fila: fila.hora_entrada_fila,
    };
  }

  /** RN-PCP-001: 1º 01 / 1º 02 entre linhas `tppcp` distintas. */
  private escolherPrimeiroCronologico(
    a: AgenteProducaoEtapa,
    b: AgenteProducaoEtapa,
    tipo: 'entrada' | 'saida',
  ): {
    usuario: number | null | undefined;
    funcionario: number | null | undefined;
    data: string | null | undefined;
    hora: string | null | undefined;
  } {
    const usuarioKey =
      tipo === 'entrada' ? 'usuario_entrada' : 'usuario_saida';
    const funcionarioKey =
      tipo === 'entrada' ? 'funcionario_entrada' : 'funcionario_saida';
    const dataKey = tipo === 'entrada' ? 'data_entrada' : 'data_saida';
    const horaKey = tipo === 'entrada' ? 'hora_entrada' : 'hora_saida';

    const candidatos = [a, b].filter((r) => r[dataKey]);
    if (candidatos.length === 0) {
      return {
        usuario: a[usuarioKey] ?? b[usuarioKey] ?? null,
        funcionario: a[funcionarioKey] ?? b[funcionarioKey] ?? null,
        data: null,
        hora: null,
      };
    }
    candidatos.sort((x, y) =>
      this.compararDataHora(
        x[dataKey] as string,
        x[horaKey] as string | null | undefined,
        y[dataKey] as string,
        y[horaKey] as string | null | undefined,
      ),
    );
    const escolhido = candidatos[0];
    return {
      usuario: escolhido[usuarioKey],
      funcionario: escolhido[funcionarioKey],
      data: escolhido[dataKey],
      hora: escolhido[horaKey],
    };
  }

  /** RN-PCP-007: em andamento se qualquer `tppcp` está com último movimento = 01. */
  private mesclarCamposFila(
    a: AgenteProducaoEtapa,
    b: AgenteProducaoEtapa,
  ): Pick<
    AgenteProducaoEtapa,
    | 'em_andamento_fila'
    | 'usuario_entrada_fila'
    | 'data_entrada_fila'
    | 'hora_entrada_fila'
  > {
    const abertos = [a, b].filter((r) => r.em_andamento_fila);
    if (abertos.length === 0) {
      return {
        em_andamento_fila: false,
        usuario_entrada_fila: null,
        data_entrada_fila: null,
        hora_entrada_fila: null,
      };
    }
    abertos.sort((x, y) =>
      this.compararDataHora(
        x.data_entrada_fila ?? '',
        x.hora_entrada_fila,
        y.data_entrada_fila ?? '',
        y.hora_entrada_fila,
      ),
    );
    const ultimo = abertos[abertos.length - 1];
    return {
      em_andamento_fila: true,
      usuario_entrada_fila: ultimo.usuario_entrada_fila ?? null,
      data_entrada_fila: ultimo.data_entrada_fila ?? null,
      hora_entrada_fila: ultimo.hora_entrada_fila ?? null,
    };
  }

  private compararDataHora(
    dataA: string,
    horaA: string | null | undefined,
    dataB: string,
    horaB: string | null | undefined,
  ): number {
    const ta = `${dataA}T${(horaA ?? '00:00:00').slice(0, 8)}`;
    const tb = `${dataB}T${(horaB ?? '00:00:00').slice(0, 8)}`;
    return ta.localeCompare(tb);
  }

  private preservarFechamentoNoPayload(
    payload: Partial<ProducaoEtapaResumo>,
    existente: ProducaoEtapaResumo,
  ): void {
    if (
      !this.usuarioValido(payload.usuarioEntrada) &&
      this.usuarioValido(existente.usuarioEntrada)
    ) {
      payload.usuarioEntrada = existente.usuarioEntrada;
    }
    if (
      !this.usuarioValido(payload.usuarioSaida) &&
      this.usuarioValido(existente.usuarioSaida)
    ) {
      payload.usuarioSaida = existente.usuarioSaida;
    }
    if (
      !this.codigoOperadorValido(payload.funcionarioEntrada) &&
      this.codigoOperadorValido(existente.funcionarioEntrada)
    ) {
      payload.funcionarioEntrada = existente.funcionarioEntrada;
    }
    if (
      !this.codigoOperadorValido(payload.funcionarioSaida) &&
      this.codigoOperadorValido(existente.funcionarioSaida)
    ) {
      payload.funcionarioSaida = existente.funcionarioSaida;
    }

    if (!payload.dataSaida?.trim() && existente.dataSaida) {
      payload.dataSaida = existente.dataSaida;
      payload.horaSaida = existente.horaSaida ?? payload.horaSaida;
      payload.usuarioSaida = existente.usuarioSaida ?? payload.usuarioSaida;
      payload.funcionarioSaida =
        existente.funcionarioSaida ?? payload.funcionarioSaida;
    }

    if (payload.dataEntrada && existente.dataEntrada) {
      const payloadPrimeiro =
        this.compararDataHora(
          payload.dataEntrada,
          payload.horaEntrada,
          existente.dataEntrada,
          existente.horaEntrada,
        ) > 0;
      if (payloadPrimeiro) {
        payload.dataEntrada = existente.dataEntrada;
        payload.horaEntrada = existente.horaEntrada;
        payload.usuarioEntrada =
          existente.usuarioEntrada ?? payload.usuarioEntrada;
        payload.funcionarioEntrada =
          existente.funcionarioEntrada ?? payload.funcionarioEntrada;
      }
    }

    if (payload.dataSaida && existente.dataSaida) {
      const payloadPrimeiro =
        this.compararDataHora(
          payload.dataSaida,
          payload.horaSaida,
          existente.dataSaida,
          existente.horaSaida,
        ) > 0;
      if (payloadPrimeiro) {
        payload.dataSaida = existente.dataSaida;
        payload.horaSaida = existente.horaSaida;
        payload.usuarioSaida = existente.usuarioSaida ?? payload.usuarioSaida;
        payload.funcionarioSaida =
          existente.funcionarioSaida ?? payload.funcionarioSaida;
      }
    }
  }
}

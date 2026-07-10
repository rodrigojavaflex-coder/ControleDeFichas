import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentDbConfig } from '../config/config.types';
import {
  CaixaFechamentoDiaRow,
  CaixaItemRow,
  CaixaPagamentoRow,
  CaixaRequisicaoPagaRow,
  OrcamentoRow,
  ValorCompraRow,
} from './database.types';
import { converterObjetoFirebird } from '../common/encoding.util';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Firebird = require('node-firebird');

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private readonly configService: ConfigService) {}

  async valorCompraPorProtocolos(
    unit: number,
    protocolos: number[],
  ): Promise<ValorCompraRow[]> {
    if (!protocolos.length) {
      return [];
    }

    const { sql, params } = this.buildValorCompraQuery(unit, protocolos);
    const options = this.getConnectOptions();
    const charset = this.getDbCharset();

    return new Promise<ValorCompraRow[]>((resolve, reject) => {
      Firebird.attach(options, (attachErr: Error, db: any) => {
        if (attachErr) {
          this.logger.error('Erro ao conectar ao banco', attachErr);
          return reject(
            new InternalServerErrorException('Erro de conexão ao banco.'),
          );
        }

        db.query(sql, params, (queryErr: Error, result: any[]) => {
          db.detach();

          if (queryErr) {
            this.logger.error('Erro ao executar consulta', queryErr);
            return reject(
              new InternalServerErrorException('Erro ao consultar banco.'),
            );
          }

          const rows = (result ?? []).map((row) =>
            this.mapValorCompraRow(converterObjetoFirebird(row, charset)),
          );
          resolve(rows);
        });
      });
    });
  }

  private buildValorCompraQuery(
    unit: number,
    protocolos: number[],
  ): { sql: string; params: Array<string | number> } {
    const placeholders = protocolos.map(() => '?').join(',');
    const sql = `
      SELECT
        tabela.nrrqu AS protocolo,
        tabela.vrrqu AS valor_compra
      FROM fc12000 tabela
      WHERE tabela.cdfil = ?
        AND tabela.nrrqu IN (${placeholders})
    `;

    const params: Array<string | number> = [unit, ...protocolos];
    return { sql, params };
  }

  private mapValorCompraRow(row: any): ValorCompraRow {
    const get = (key: string) =>
      row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];

    return {
      protocolo: Number(get('protocolo') ?? 0),
      valor_compra: Number(get('valor_compra') ?? 0),
    };
  }

  private getDbCharset(): string {
    const dbConfig = this.configService.get<AgentDbConfig>('agent.db');
    const charset = dbConfig?.charset?.trim();
    return charset || 'NONE';
  }

  private getConnectOptions(): Record<string, unknown> {
    const dbConfig = this.configService.get<AgentDbConfig>('agent.db');

    if (!dbConfig) {
      throw new InternalServerErrorException('Configuração de banco ausente.');
    }

    if (!dbConfig.path) {
      throw new InternalServerErrorException('DB_PATH não definido.');
    }

    const charset = this.getDbCharset();
    const options: Record<string, unknown> = {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.path,
      user: dbConfig.user,
      password: dbConfig.password,
      role: dbConfig.role,
      lowercase_keys: true,
    };

    if (charset && charset.toUpperCase() !== 'NONE') {
      options.charset = charset;
    }

    return options;
  }

  async buscarClientes(
    dataMinima: string,
    unit: number,
  ): Promise<any[]> {
    const { sql, params } = this.buildClientesQuery(dataMinima, unit);
    const options = this.getConnectOptions();
    const charset = this.getDbCharset();

    return new Promise<any[]>((resolve, reject) => {
      Firebird.attach(options, (attachErr: Error, db: any) => {
        if (attachErr) {
          this.logger.error('Erro ao conectar ao banco', attachErr);
          return reject(new InternalServerErrorException('Erro de conexão ao banco.'));
        }

        db.query(sql, params, (queryErr: Error, result: any[]) => {
          db.detach();

          if (queryErr) {
            this.logger.error('Erro ao executar consulta de clientes', queryErr);
            return reject(new InternalServerErrorException('Erro ao consultar banco.'));
          }

          const rows = (result ?? []).map((row) =>
            this.mapClienteRow(converterObjetoFirebird(row, charset)),
          );
          resolve(rows);
        });
      });
    });
  }

  async buscarPrescritores(dataMinima: string): Promise<any[]> {
    const { sql, params } = this.buildPrescritoresQuery(dataMinima);
    const options = this.getConnectOptions();
    const charset = this.getDbCharset();

    return new Promise<any[]>((resolve, reject) => {
      Firebird.attach(options, (attachErr: Error, db: any) => {
        if (attachErr) {
          this.logger.error('Erro ao conectar ao banco', attachErr);
          return reject(new InternalServerErrorException('Erro de conexão ao banco.'));
        }

        db.query(sql, params, (queryErr: Error, result: any[]) => {
          db.detach();

          if (queryErr) {
            this.logger.error('Erro ao executar consulta de prescritores', queryErr);
            return reject(new InternalServerErrorException('Erro ao consultar banco.'));
          }

          const rows = (result ?? []).map((row) =>
            this.mapPrescritorRow(converterObjetoFirebird(row, charset)),
          );
          resolve(rows);
        });
      });
    });
  }

  /**
   * Busca clientes e prescritores em uma única conexão (otimizado)
   */
  async buscarClientesEPrescritores(
    dataMinimaCliente: string,
    dataMinimaPrescritor: string,
    unit: number,
  ): Promise<{ clientes: any[]; prescritores: any[] }> {
    const { sql: sqlClientes, params: paramsClientes } = this.buildClientesQuery(
      dataMinimaCliente,
      unit,
    );
    const { sql: sqlPrescritores, params: paramsPrescritores } =
      this.buildPrescritoresQuery(dataMinimaPrescritor);
    const options = this.getConnectOptions();
    const charset = this.getDbCharset();

    return new Promise<{ clientes: any[]; prescritores: any[] }>(
      (resolve, reject) => {
        Firebird.attach(options, (attachErr: Error, db: any) => {
          if (attachErr) {
            this.logger.error('Erro ao conectar ao banco', attachErr);
            return reject(
              new InternalServerErrorException('Erro de conexão ao banco.'),
            );
          }

          // Executar ambas as queries na mesma conexão
          this.logger.log(`Executando query de clientes com ${paramsClientes.length} parâmetros...`);
          db.query(sqlClientes, paramsClientes, (queryErr1: Error, result1: any[]) => {
            if (queryErr1) {
              db.detach();
              this.logger.error(`Erro ao executar consulta de clientes: ${queryErr1.message}`, queryErr1);
              this.logger.error(`SQL: ${sqlClientes.trim()}`);
              this.logger.error(`Parâmetros: ${JSON.stringify(paramsClientes)}`);
              return reject(
                new InternalServerErrorException('Erro ao consultar clientes.'),
              );
            }

            this.logger.log(`Query de clientes executada com sucesso. Registros retornados: ${result1?.length || 0}`);

            this.logger.log(`Executando query de prescritores com ${paramsPrescritores.length} parâmetros...`);
            db.query(
              sqlPrescritores,
              paramsPrescritores,
              (queryErr2: Error, result2: any[]) => {
                db.detach();

                if (queryErr2) {
                  this.logger.error(`Erro ao executar consulta de prescritores: ${queryErr2.message}`, queryErr2);
                  this.logger.error(`SQL: ${sqlPrescritores.trim()}`);
                  this.logger.error(`Parâmetros: ${JSON.stringify(paramsPrescritores)}`);
                  return reject(
                    new InternalServerErrorException('Erro ao consultar prescritores.'),
                  );
                }

                this.logger.log(`Query de prescritores executada com sucesso. Registros retornados: ${result2?.length || 0}`);

                const clientes = (result1 ?? []).map((row) =>
                  this.mapClienteRow(converterObjetoFirebird(row, charset)),
                );
                const prescritores = (result2 ?? []).map((row) =>
                  this.mapPrescritorRow(converterObjetoFirebird(row, charset)),
                );

                this.logger.log(`Total processado: ${clientes.length} clientes, ${prescritores.length} prescritores`);
                resolve({ clientes, prescritores });
              },
            );
          });
        });
      },
    );
  }

  private buildClientesQuery(
    dataMinima: string,
    unit: number,
  ): { sql: string; params: Array<string | number> } {
    const sql = `
      SELECT 
        cliente.cdcli AS cdcli,
        cliente.nomecli AS nomecli,
        cliente.nrcnpj AS nrcnpj,
        cliente.email AS email,
        cliente.dtnas AS dtnas,
        cliente.cdfil AS cdfil,
        cliente.dtcad AS dtcad
      FROM fc07000 cliente
      WHERE cliente.cdfil = ? AND cliente.dtcad >= ?
      ORDER BY cliente.cdcli, cliente.dtcad
    `;

    const params: Array<string | number> = [unit, dataMinima];
    
    this.logger.log(`Query SQL de clientes:`);
    this.logger.log(`  SQL: ${sql.trim().replace(/\s+/g, ' ')}`);
    this.logger.log(`  Parâmetros: cdfil=${unit}, dtcad>=${dataMinima}`);
    
    return { sql, params };
  }

  private buildPrescritoresQuery(
    dataMinima: string,
  ): { sql: string; params: Array<string> } {
    const sql = `
      SELECT 
        prescritor.nrcrm AS nrcrm,
        prescritor.ufcrm AS ufcrm,
        prescritor.nomemed AS nomemed,
        prescritor.dtcad AS dtcad
      FROM fc04000 prescritor
      WHERE prescritor.dtcad >= ?
      ORDER BY prescritor.dtcad
    `;

    const params: Array<string> = [dataMinima];
    
    // ADICIONAR LOG para debug do filtro de prescritores
    this.logger.log(`[Agente - DB] Query de prescritores:`);
    this.logger.log(`  SQL: ${sql.trim()}`);
    this.logger.log(`  Parâmetro dataMinima: ${dataMinima} (tipo: ${typeof dataMinima})`);
    
    return { sql, params };
  }

  private mapClienteRow(row: any): any {
    const get = (key: string) =>
      row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];

    // Converter dtcad para YYYY-MM-DD
    const dtcadRaw = get('dtcad');
    let dtcad = '';
    if (dtcadRaw) {
      if (dtcadRaw instanceof Date) {
        dtcad = this.formatDate(dtcadRaw);
      } else {
        const dateStr = String(dtcadRaw);
        // Tentar converter diferentes formatos para YYYY-MM-DD
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          dtcad = this.formatDate(date);
        } else {
          // Tentar parsear formato DD/MM/YYYY ou DD-MM-YYYY
          const parts = dateStr.split(/[\/\-]/);
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            dtcad = `${year}-${month}-${day}`;
          } else {
            dtcad = dateStr; // Manter original se não conseguir converter
          }
        }
      }
    }

    return {
      cdcli: Number(get('cdcli') ?? 0),
      nomecli: String(get('nomecli') ?? ''),
      nrcnpj: get('nrcnpj') ? String(get('nrcnpj')) : undefined,
      email: get('email') ? String(get('email')) : undefined,
      dtnas: get('dtnas') ? String(get('dtnas')) : undefined,
      cdfil: Number(get('cdfil') ?? 0),
      dtcad: dtcad,
    };
  }

  private mapPrescritorRow(row: any): any {
    const get = (key: string) =>
      row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];

    // Converter dtcad para YYYY-MM-DD
    const dtcadRaw = get('dtcad');
    let dtcad = '';
    if (dtcadRaw) {
      if (dtcadRaw instanceof Date) {
        dtcad = this.formatDate(dtcadRaw);
      } else {
        const dateStr = String(dtcadRaw);
        // Tentar converter diferentes formatos para YYYY-MM-DD
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          dtcad = this.formatDate(date);
        } else {
          // Tentar parsear formato DD/MM/YYYY ou DD-MM-YYYY
          const parts = dateStr.split(/[\/\-]/);
          if (parts.length === 3) {
            const day = parts[0].padStart(2, '0');
            const month = parts[1].padStart(2, '0');
            const year = parts[2];
            dtcad = `${year}-${month}-${day}`;
          } else {
            dtcad = dateStr; // Manter original se não conseguir converter
          }
        }
      }
    }

    return {
      nrcrm: get('nrcrm') ? Number(get('nrcrm')) : undefined,
      ufcrm: get('ufcrm') ? String(get('ufcrm')) : undefined,
      nomemed: String(get('nomemed') ?? ''),
      dtcad: dtcad,
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  async buscarOrcamentos(
    dataMinimaModificacao: string,
    unit: number,
  ): Promise<OrcamentoRow[]> {
    const { sql, params } = this.buildOrcamentosQuery(
      dataMinimaModificacao,
      unit,
    );
    const options = this.getConnectOptions();
    const charset = this.getDbCharset();

    return new Promise<OrcamentoRow[]>((resolve, reject) => {
      Firebird.attach(options, (attachErr: Error, db: any) => {
        if (attachErr) {
          this.logger.error('Erro ao conectar ao banco', attachErr);
          return reject(
            new InternalServerErrorException('Erro de conexão ao banco.'),
          );
        }

        this.logger.log(
          `Executando query de orçamentos com ${params.length} parâmetros...`,
        );
        db.query(sql, params, (queryErr: Error, result: any[]) => {
          db.detach();

          if (queryErr) {
            this.logger.error(
              `Erro ao executar consulta de orçamentos: ${queryErr.message}`,
              queryErr,
            );
            this.logger.error(`SQL: ${sql.trim()}`);
            this.logger.error(`Parâmetros: ${JSON.stringify(params)}`);
            return reject(
              new InternalServerErrorException('Erro ao consultar orçamentos.'),
            );
          }

          const rows = (result ?? []).map((row) =>
            this.mapOrcamentoRow(converterObjetoFirebird(row, charset)),
          );
          this.logger.log(
            `Query de orçamentos executada. Registros retornados: ${rows.length}`,
          );
          resolve(rows);
        });
      });
    });
  }

  private buildOrcamentosQuery(
    dataMinimaModificacao: string,
    unit: number,
  ): { sql: string; params: Array<string | number> } {
    const dataParam = dataMinimaModificacao.includes('T')
      ? dataMinimaModificacao.replace('T', ' ')
      : `${dataMinimaModificacao} 00:00:00`;

    const sql = `
      SELECT
        o.dtmodificacao AS ultima_modificacao,
        o.cdfil AS filial,
        o.dtentr AS data_orcamento,
        o.nrorc AS nrorc,
        o.serieo AS serieo,
        o.nrorc || '-' || o.serieo AS nr_orcamento,
        CASE
          WHEN COALESCE(o.qtaprov, 0) = 0 THEN 'REJEITADO'
          ELSE 'APROVADO'
        END AS status_orcamento,
        CAST(o.prcobr - COALESCE(o.vrdsc, 0) AS NUMERIC(15, 2)) AS preco_venda,
        o.prcobr AS preco_cobrado,
        COALESCE(o.vrdsc, 0) AS desconto_formula,
        COALESCE(o.cdcli, cap.cdcli) AS codigo_cliente,
        o.cdfunre AS codigo_vendedor,
        TRIM(v.nomefun) AS nome_vendedor,
        TRIM(cap.nomepa) AS nome_cliente,
        CAST(o.NRCRM AS VARCHAR(20)) AS crm_medico,
        TRIM(o.UFCRM) AS ufcrm_medico,
        TRIM(med.NOMEMED) AS nome_medico
      FROM fc15100 o
      JOIN fc15000 cap
        ON cap.cdfil = o.cdfil
       AND cap.nrorc = o.nrorc
      JOIN fc08000 v
        ON v.cdfun = o.cdfunre
       AND v.cdcon = o.cdconre
      LEFT JOIN fc04000 med
        ON med.pfcrm = o.pfcrm
       AND med.ufcrm = o.ufcrm
       AND med.nrcrm = o.nrcrm
      WHERE o.cdfil = ?
        AND o.dtmodificacao >= ?
      ORDER BY o.dtmodificacao ASC, o.nrorc ASC, o.serieo ASC
    `;

    const params: Array<string | number> = [unit, dataParam];

    this.logger.log(`Query SQL de orçamentos:`);
    this.logger.log(`  Parâmetros: cdfil=${unit}, dtmodificacao>=${dataParam}`);

    return { sql, params };
  }

  private mapOrcamentoRow(row: any): OrcamentoRow {
    const get = (key: string) =>
      row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];

    const ultimaModificacaoRaw = get('ultima_modificacao');
    const dataOrcamentoRaw = get('data_orcamento');

    const codigoCliente = get('codigo_cliente');
    const nomeCliente = get('nome_cliente');
    const codigoVendedor = get('codigo_vendedor');
    const nomeVendedor = get('nome_vendedor');
    const crmMedico = get('crm_medico');
    const ufcrmMedico = get('ufcrm_medico');
    const nomeMedico = get('nome_medico');

    return {
      ultima_modificacao: this.formatDateTime(ultimaModificacaoRaw),
      filial: Number(get('filial') ?? 0),
      data_orcamento: this.formatDateField(dataOrcamentoRaw),
      nrorc: Number(get('nrorc') ?? 0),
      serieo: String(get('serieo') ?? '').trim(),
      nr_orcamento: String(get('nr_orcamento') ?? '').trim(),
      status_orcamento:
        String(get('status_orcamento') ?? '').trim() === 'APROVADO'
          ? 'APROVADO'
          : 'REJEITADO',
      preco_venda: Number(get('preco_venda') ?? 0),
      preco_cobrado: Number(get('preco_cobrado') ?? 0),
      desconto_formula: Number(get('desconto_formula') ?? 0),
      codigo_cliente:
        codigoCliente !== null && codigoCliente !== undefined && codigoCliente !== ''
          ? Number(codigoCliente)
          : null,
      nome_cliente: nomeCliente ? String(nomeCliente).trim() : null,
      codigo_vendedor:
        codigoVendedor !== null &&
        codigoVendedor !== undefined &&
        codigoVendedor !== ''
          ? Number(codigoVendedor)
          : null,
      nome_vendedor: nomeVendedor ? String(nomeVendedor).trim() : null,
      crm_medico:
        crmMedico !== null && crmMedico !== undefined && String(crmMedico).trim()
          ? String(crmMedico).trim()
          : null,
      ufcrm_medico:
        ufcrmMedico !== null && ufcrmMedico !== undefined && String(ufcrmMedico).trim()
          ? String(ufcrmMedico).trim()
          : null,
      nome_medico: nomeMedico ? String(nomeMedico).trim() : null,
    };
  }

  private formatDateField(value: unknown): string {
    if (!value) return '';
    if (value instanceof Date) {
      return this.formatDate(value);
    }
    const dateStr = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return this.formatDate(date);
    }
    const parts = dateStr.split(/[\/\-]/);
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${year}-${month}-${day}`;
    }
    return dateStr;
  }

  private formatDateTime(value: unknown): string {
    if (!value) return '';
    if (value instanceof Date) {
      return this.toIsoDateTimeLocal(value);
    }
    const dateStr = String(value).trim();
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(dateStr)) {
      return dateStr;
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(dateStr)) {
      return dateStr.replace(' ', 'T').slice(0, 19);
    }
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return this.toIsoDateTimeLocal(date);
    }
    return dateStr;
  }

  private toIsoDateTimeLocal(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  async buscarCaixaPagamentos(
    unit: number,
    start: string,
    end: string,
    filtrarFlagBaixa = false,
  ): Promise<CaixaPagamentoRow[]> {
    const { sql, params } = this.buildCaixaPagamentosQuery(
      unit,
      start,
      end,
      filtrarFlagBaixa,
    );
    return this.executarConsultaCaixa(sql, params, (row) =>
      this.mapCaixaPagamentoRow(row),
    );
  }

  async buscarCaixaItens(
    unit: number,
    start: string,
    end: string,
    filtrarFlagBaixa = false,
  ): Promise<CaixaItemRow[]> {
    const { sql, params } = this.buildCaixaItensQuery(
      unit,
      start,
      end,
      filtrarFlagBaixa,
    );
    return this.executarConsultaCaixa(sql, params, (row) =>
      this.mapCaixaItemRow(row),
    );
  }

  async buscarCaixaRequisicoesPagas(
    unit: number,
    start: string,
    end: string,
  ): Promise<CaixaRequisicaoPagaRow[]> {
    const { sql, params } = this.buildCaixaRequisicoesPagasQuery(
      unit,
      start,
      end,
    );
    return this.executarConsultaCaixa(sql, params, (row) =>
      this.mapCaixaRequisicaoPagaRow(row),
    );
  }

  async buscarCaixaFechamentoDia(
    unit: number,
    start: string,
    end: string,
    filtrarFlagBaixa = false,
  ): Promise<CaixaFechamentoDiaRow[]> {
    const { sql, params } = this.buildCaixaFechamentoDiaQuery(
      unit,
      start,
      end,
      filtrarFlagBaixa,
    );
    return this.executarConsultaCaixa(sql, params, (row) =>
      this.mapCaixaFechamentoDiaRow(row),
    );
  }

  private executarConsultaCaixa<T>(
    sql: string,
    params: Array<string | number>,
    mapper: (row: Record<string, unknown>) => T,
  ): Promise<T[]> {
    const options = this.getConnectOptions();
    const charset = this.getDbCharset();

    return new Promise<T[]>((resolve, reject) => {
      Firebird.attach(options, (attachErr: Error, db: any) => {
        if (attachErr) {
          this.logger.error('Erro ao conectar ao banco (caixa)', attachErr);
          return reject(
            new InternalServerErrorException('Erro de conexão ao banco.'),
          );
        }

        db.query(sql, params, (queryErr: Error, result: any[]) => {
          db.detach();

          if (queryErr) {
            this.logger.error('Erro ao executar consulta caixa', queryErr);
            return reject(
              new InternalServerErrorException('Erro ao consultar banco.'),
            );
          }

          const rows = (result ?? []).map((row) =>
            mapper(converterObjetoFirebird(row, charset) as Record<string, unknown>),
          );
          resolve(rows);
        });
      });
    });
  }

  private buildCaixaPagamentosQuery(
    unit: number,
    start: string,
    end: string,
    filtrarFlagBaixa: boolean,
  ): { sql: string; params: Array<string | number> } {
    const flagFilter = filtrarFlagBaixa
      ? " AND COALESCE(capa.flagbxa, 'N') = 'S'"
      : '';

    const sql = `
      SELECT
        pag.cdfil AS filial,
        pag.dtope AS data,
        pag.nrcpm AS cupom,
        pag.cdtml AS cdtml,
        pag.operid AS operid,
        pag.fmpag AS fmpag,
        COALESCE(pag.indrecconv, 'N') AS indrecconv,
        CASE pag.fmpag
          WHEN '1' THEN
            CASE WHEN COALESCE(pag.indrecconv, 'N') = 'S'
                 THEN 'CONVENIO-DINHEIRO'
                 ELSE 'DINHEIRO'
            END
          WHEN '4' THEN 'DEPOSITO'
          WHEN '6' THEN 'CARTAO PRE'
          ELSE TRIM(pag.fmpag)
        END AS forma_pagamento,
        pag.vrpag AS valor_bruto,
        COALESCE(pag.vrtrc, 0) AS troco,
        pag.vrpag - COALESCE(pag.vrtrc, 0) AS valor_liquido,
        capa.vrtot AS total_cupom_bruto,
        capa.vrliq AS total_cupom_liquido,
        capa.cdcli AS cdcli,
        capa.cdfunre AS codigo_operador,
        fun_oper.nomefun AS operador_caixa
      FROM fc31600 pag
      LEFT JOIN fc31100 capa
        ON capa.cdfil = pag.cdfil
       AND capa.cdtml = pag.cdtml
       AND capa.dtope = pag.dtope
       AND capa.operid = pag.operid
       AND capa.nrcpm = pag.nrcpm
      LEFT JOIN fc08000 fun_oper
        ON fun_oper.cdfun = capa.cdfunre
       AND fun_oper.cdcon = capa.cdconre
      WHERE pag.cdfil = ?
        AND pag.dtope BETWEEN ? AND ?${flagFilter}
      ORDER BY pag.dtope, pag.nrcpm, forma_pagamento
    `;

    return { sql, params: [unit, start, end] };
  }

  private buildCaixaItensQuery(
    unit: number,
    start: string,
    end: string,
    filtrarFlagBaixa = false,
  ): { sql: string; params: Array<string | number> } {
    const flagFilter = filtrarFlagBaixa
      ? " AND COALESCE(capa.flagbxa, 'N') = 'S'"
      : '';

    const sql = `
      SELECT
        capa.cdfil AS filial,
        capa.dtope AS data,
        capa.nrcpm AS cupom,
        capa.cdtml AS cdtml,
        capa.operid AS operid,
        item.itemid AS item_cupom,
        CASE
          WHEN req.nrrqu IS NOT NULL THEN 'REQUISICAO'
          ELSE 'PRODUTO'
        END AS tipo_item,
        COALESCE(req.nrrqu, item.cdpro) AS codigo_item,
        req.nrrqu AS requisicao,
        CASE
          WHEN req.nrrqu IS NOT NULL THEN NULL
          ELSE TRIM(COALESCE(prod.descr, prod.descrprd))
        END AS descricao_item,
        item.quant AS quant,
        item.vrtot AS valor_item_bruto,
        item.vrliq AS valor_item_liquido,
        item.vrdsc AS desconto_item,
        COALESCE((
          SELECT SUM(p.vrpag - COALESCE(p.vrtrc, 0))
          FROM fc31600 p
          WHERE p.cdfil = capa.cdfil
            AND p.cdtml = capa.cdtml
            AND p.dtope = capa.dtope
            AND p.operid = capa.operid
            AND p.nrcpm = capa.nrcpm
        ), 0) AS pagamento_cupom
      FROM fc31100 capa
      JOIN fc31110 item
        ON item.cdfil = capa.cdfil
       AND item.cdtml = capa.cdtml
       AND item.dtope = capa.dtope
       AND item.operid = capa.operid
       AND item.nrcpm = capa.nrcpm
      LEFT JOIN fc31200 req
        ON req.cdfil = item.cdfil
       AND req.cdtml = item.cdtml
       AND req.dtope = item.dtope
       AND req.operid = item.operid
       AND req.nrcpm = item.nrcpm
       AND req.itemid = item.itemid
      LEFT JOIN fc03000 prod
        ON prod.cdpro = item.cdpro
      WHERE capa.cdfil = ?
        AND capa.dtope BETWEEN ? AND ?${flagFilter}
      ORDER BY capa.dtope, capa.nrcpm, item.itemid
    `;

    return { sql, params: [unit, start, end] };
  }

  private buildCaixaRequisicoesPagasQuery(
    unit: number,
    start: string,
    end: string,
  ): { sql: string; params: Array<string | number> } {
    const sql = `
      SELECT
        r.cdfil AS filial,
        r.dtefe AS data_pagamento,
        r.nrrqu AS requisicao,
        r.nrcpm AS cupom,
        form.nrorc AS nr_orcamento,
        orc.qtd_formulas AS qtd_formulas,
        orc.valor_orcamento AS valor_orcamento,
        r.vrrqu AS valor_requisicao_bruto,
        r.vrdsc AS desconto_requisicao,
        r.vrliq AS valor_pago_requisicao,
        r.vrrqu - r.vrdsc - r.vrliq AS diferenca_calculo,
        orc.valor_orcamento - r.vrliq AS gap_orcamento_vs_pago,
        vend.cdfun AS codigo_vendedor,
        fun.nomefun AS vendedor
      FROM fc17000 r
      LEFT JOIN fc12100 form
        ON form.cdfil = r.cdfil
       AND form.nrrqu = r.nrrqu
       AND form.serier = '0'
      LEFT JOIN (
        SELECT
          o.cdfil,
          o.nrorc,
          COUNT(*) AS qtd_formulas,
          SUM(o.prcobr - COALESCE(o.vrdsc, 0)) AS valor_orcamento
        FROM fc15100 o
        GROUP BY o.cdfil, o.nrorc
      ) orc
        ON orc.cdfil = form.cdfil
       AND orc.nrorc = form.nrorc
      LEFT JOIN fc17200 vend
        ON vend.cdfil = r.cdfil
       AND vend.nrrqu = r.nrrqu
       AND vend.tptar = 'R'
      LEFT JOIN fc08000 fun
        ON fun.cdfun = vend.cdfun
       AND fun.cdcon = vend.cdcon
      WHERE r.cdfil = ?
        AND r.dtefe BETWEEN ? AND ?
        AND COALESCE(r.vrliq, 0) <> 0
      ORDER BY r.dtefe, r.nrcpm, r.nrrqu
    `;

    return { sql, params: [unit, start, end] };
  }

  private buildCaixaFechamentoDiaQuery(
    unit: number,
    start: string,
    end: string,
    filtrarFlagBaixa: boolean,
  ): { sql: string; params: Array<string | number> } {
    const flagJoin = filtrarFlagBaixa
      ? `
      JOIN fc31100 capa
        ON capa.cdfil = pag.cdfil
       AND capa.cdtml = pag.cdtml
       AND capa.dtope = pag.dtope
       AND capa.operid = pag.operid
       AND capa.nrcpm = pag.nrcpm
       AND COALESCE(capa.flagbxa, 'N') = 'S'`
      : '';

    const sql = `
      SELECT
        CASE pag.fmpag
          WHEN '1' THEN
            CASE WHEN COALESCE(pag.indrecconv, 'N') = 'S'
                 THEN 'CONVENIO-DINHEIRO'
                 ELSE 'DINHEIRO'
            END
          WHEN '4' THEN 'DEPOSITO'
          WHEN '6' THEN 'CARTAO PRE'
          ELSE TRIM(pag.fmpag)
        END AS forma_pagamento,
        COUNT(*) AS qtd_baixas,
        SUM(pag.vrpag) AS total_bruto,
        SUM(COALESCE(pag.vrtrc, 0)) AS total_troco,
        SUM(pag.vrpag - COALESCE(pag.vrtrc, 0)) AS total_liquido
      FROM fc31600 pag${flagJoin}
      WHERE pag.cdfil = ?
        AND pag.dtope BETWEEN ? AND ?
      GROUP BY 1
      ORDER BY 1
    `;

    return { sql, params: [unit, start, end] };
  }

  private mapCaixaPagamentoRow(row: Record<string, unknown>): CaixaPagamentoRow {
    const get = (key: string) =>
      row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];

    const filial = Number(get('filial') ?? 0);
    const data = this.formatDateField(get('data'));
    const cupom = Number(get('cupom') ?? 0);
    const cdtml = Number(get('cdtml') ?? 0);
    const operid = Number(get('operid') ?? 0);
    const fmpag = String(get('fmpag') ?? '').trim();
    const indrecconv = String(get('indrecconv') ?? 'N').trim();

    return {
      filial,
      data,
      cupom,
      cdtml,
      operid,
      fmpag,
      indrecconv,
      forma_pagamento: String(get('forma_pagamento') ?? '').trim(),
      valor_bruto: Number(get('valor_bruto') ?? 0),
      troco: Number(get('troco') ?? 0),
      valor_liquido: Number(get('valor_liquido') ?? 0),
      total_cupom_bruto:
        get('total_cupom_bruto') != null
          ? Number(get('total_cupom_bruto'))
          : null,
      total_cupom_liquido:
        get('total_cupom_liquido') != null
          ? Number(get('total_cupom_liquido'))
          : null,
      cdcli: get('cdcli') != null ? Number(get('cdcli')) : null,
      codigo_operador:
        get('codigo_operador') != null ? Number(get('codigo_operador')) : null,
      operador_caixa: get('operador_caixa')
        ? String(get('operador_caixa')).trim()
        : null,
      chave_erp: `${filial}-${cdtml}-${data}-${operid}-${cupom}-${fmpag}`,
    };
  }

  private mapCaixaItemRow(row: Record<string, unknown>): CaixaItemRow {
    const get = (key: string) =>
      row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];

    const filial = Number(get('filial') ?? 0);
    const data = this.formatDateField(get('data'));
    const cupom = Number(get('cupom') ?? 0);
    const cdtml = Number(get('cdtml') ?? 0);
    const operid = Number(get('operid') ?? 0);
    const itemCupom = Number(get('item_cupom') ?? 0);
    const tipoRaw = String(get('tipo_item') ?? 'PRODUTO').trim();

    return {
      filial,
      data,
      cupom,
      cdtml,
      operid,
      item_cupom: itemCupom,
      tipo_item: tipoRaw === 'REQUISICAO' ? 'REQUISICAO' : 'PRODUTO',
      codigo_item: get('codigo_item') != null ? Number(get('codigo_item')) : null,
      requisicao: get('requisicao') != null ? Number(get('requisicao')) : null,
      descricao_item: get('descricao_item')
        ? String(get('descricao_item')).trim()
        : null,
      quant: Number(get('quant') ?? 0),
      valor_item_bruto: Number(get('valor_item_bruto') ?? 0),
      valor_item_liquido: Number(get('valor_item_liquido') ?? 0),
      desconto_item: Number(get('desconto_item') ?? 0),
      pagamento_cupom: Number(get('pagamento_cupom') ?? 0),
      chave_erp: `${filial}-${cdtml}-${data}-${operid}-${cupom}-${itemCupom}`,
    };
  }

  private mapCaixaRequisicaoPagaRow(
    row: Record<string, unknown>,
  ): CaixaRequisicaoPagaRow {
    const get = (key: string) =>
      row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];

    const filial = Number(get('filial') ?? 0);
    const dataPagamento = this.formatDateField(get('data_pagamento'));
    const requisicao = Number(get('requisicao') ?? 0);
    const cupom = Number(get('cupom') ?? 0);

    return {
      filial,
      data_pagamento: dataPagamento,
      requisicao,
      cupom,
      nr_orcamento:
        get('nr_orcamento') != null ? Number(get('nr_orcamento')) : null,
      qtd_formulas:
        get('qtd_formulas') != null ? Number(get('qtd_formulas')) : null,
      valor_orcamento:
        get('valor_orcamento') != null ? Number(get('valor_orcamento')) : null,
      valor_requisicao_bruto: Number(get('valor_requisicao_bruto') ?? 0),
      desconto_requisicao: Number(get('desconto_requisicao') ?? 0),
      valor_pago_requisicao: Number(get('valor_pago_requisicao') ?? 0),
      diferenca_calculo: Number(get('diferenca_calculo') ?? 0),
      gap_orcamento_vs_pago:
        get('gap_orcamento_vs_pago') != null
          ? Number(get('gap_orcamento_vs_pago'))
          : null,
      codigo_vendedor:
        get('codigo_vendedor') != null ? Number(get('codigo_vendedor')) : null,
      vendedor: get('vendedor') ? String(get('vendedor')).trim() : null,
      chave_erp: `${filial}-${requisicao}-${cupom}-${dataPagamento}`,
    };
  }

  private mapCaixaFechamentoDiaRow(
    row: Record<string, unknown>,
  ): CaixaFechamentoDiaRow {
    const get = (key: string) =>
      row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];

    return {
      forma_pagamento: String(get('forma_pagamento') ?? '').trim(),
      qtd_baixas: Number(get('qtd_baixas') ?? 0),
      total_bruto: Number(get('total_bruto') ?? 0),
      total_troco: Number(get('total_troco') ?? 0),
      total_liquido: Number(get('total_liquido') ?? 0),
    };
  }
}

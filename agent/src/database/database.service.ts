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
import {
  converterObjetoFirebird,
  converterTextoFirebird,
  corrigirPadroesGravadosErrados,
  padronizarDescricaoLegado,
  precisaCorrecaoEncoding,
} from '../common/encoding.util';
import {
  deduplicarExclusoesPorFormula,
  parseExclusaoReceitaEvento,
} from '../common/producao-exclusoes.util';

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
      // LIST() e outros TEXT BLOB precisam vir como string (node-firebird #353)
      blobAsText: true,
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

  async buscarOrcamentosPorPeriodo(
    unit: number,
    start: string,
    end: string,
  ): Promise<OrcamentoRow[]> {
    const { sql, params } = this.buildOrcamentosPeriodoQuery(unit, start, end);
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
          `Executando query de orçamentos por período com ${params.length} parâmetros...`,
        );

        db.query(sql, params, (queryErr: Error, result: any[]) => {
          db.detach();

          if (queryErr) {
            this.logger.error(
              `Erro ao executar consulta de orçamentos por período: ${queryErr.message}`,
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
            `Orçamentos por período: ${rows.length} registros (${start} a ${end})`,
          );
          resolve(rows);
        });
      });
    });
  }

  private buildOrcamentosPeriodoQuery(
    unit: number,
    start: string,
    end: string,
  ): { sql: string; params: Array<string | number> } {
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
        AND o.dtentr >= ?
        AND o.dtentr <= ?
      ORDER BY o.dtentr ASC, o.nrorc ASC, o.serieo ASC
    `;

    const params: Array<string | number> = [unit, start, end];

    this.logger.log(`Query SQL de orçamentos por período:`);
    this.logger.log(
      `  Parâmetros: cdfil=${unit}, dtentr entre ${start} e ${end}`,
    );

    return { sql, params };
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
    return this.executarConsultaCaixa(
      sql,
      params,
      (row) => this.mapCaixaPagamentoRow(row),
      'pagamentos',
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
    return this.executarConsultaCaixa(
      sql,
      params,
      (row) => this.mapCaixaItemRow(row),
      'itens',
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
    return this.executarConsultaCaixa(
      sql,
      params,
      (row) => this.mapCaixaRequisicaoPagaRow(row),
      'requisicoes-pagas',
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
    rotulo = 'caixa',
  ): Promise<T[]> {
    const options = this.getConnectOptions();
    const charset = this.getDbCharset();
    const inicio = Date.now();

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
            this.logger.error(`Erro ao executar consulta caixa (${rotulo})`, queryErr);
            return reject(
              new InternalServerErrorException('Erro ao consultar banco.'),
            );
          }

          const rows = (result ?? []).map((row) =>
            mapper(converterObjetoFirebird(row, charset) as Record<string, unknown>),
          );
          this.logger.log(
            `Consulta caixa ${rotulo}: ${rows.length} registro(s) em ${Date.now() - inicio}ms`,
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
        COALESCE(pag_cupom.pagamento_cupom, 0) AS pagamento_cupom
      FROM fc31100 capa
      JOIN fc31110 item
        ON item.cdfil = capa.cdfil
       AND item.cdtml = capa.cdtml
       AND item.dtope = capa.dtope
       AND item.operid = capa.operid
       AND item.nrcpm = capa.nrcpm
      LEFT JOIN (
        SELECT
          p.cdfil,
          p.cdtml,
          p.dtope,
          p.operid,
          p.nrcpm,
          SUM(p.vrpag - COALESCE(p.vrtrc, 0)) AS pagamento_cupom
        FROM fc31600 p
        WHERE p.cdfil = ?
          AND p.dtope BETWEEN ? AND ?
        GROUP BY p.cdfil, p.cdtml, p.dtope, p.operid, p.nrcpm
      ) pag_cupom
        ON pag_cupom.cdfil = capa.cdfil
       AND pag_cupom.cdtml = capa.cdtml
       AND pag_cupom.dtope = capa.dtope
       AND pag_cupom.operid = capa.operid
       AND pag_cupom.nrcpm = capa.nrcpm
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

    return { sql, params: [unit, start, end, unit, start, end] };
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
        (SELECT COUNT(*)
         FROM fc15100 o
         WHERE o.cdfil = form.cdfil
           AND o.nrorc = form.nrorc
           AND COALESCE(form.nrorc, 0) > 0) AS qtd_formulas,
        (SELECT SUM(o.prcobr - COALESCE(o.vrdsc, 0))
         FROM fc15100 o
         WHERE o.cdfil = form.cdfil
           AND o.nrorc = form.nrorc
           AND COALESCE(form.nrorc, 0) > 0) AS valor_orcamento,
        r.vrrqu AS valor_requisicao_bruto,
        r.vrdsc AS desconto_requisicao,
        r.vrliq AS valor_pago_requisicao,
        r.vrrqu - r.vrdsc - r.vrliq AS diferenca_calculo,
        (SELECT SUM(o.prcobr - COALESCE(o.vrdsc, 0))
         FROM fc15100 o
         WHERE o.cdfil = form.cdfil
           AND o.nrorc = form.nrorc
           AND COALESCE(form.nrorc, 0) > 0) - r.vrliq AS gap_orcamento_vs_pago,
        vend.cdfun AS codigo_vendedor,
        fun.nomefun AS vendedor,
        CAST(form.nrcrm AS VARCHAR(20)) AS crm_medico,
        TRIM(form.ufcrm) AS uf_crm_medico,
        TRIM(m.nomemed) AS nome_medico
      FROM fc17000 r
      LEFT JOIN (
        SELECT
          direct.cdfil,
          direct.nrrqu,
          COALESCE(
            MAX(CASE WHEN TRIM(direct.serier) = '0' AND COALESCE(direct.nrorc, 0) > 0 THEN direct.nrorc END),
            MIN(CASE WHEN COALESCE(direct.nrorc, 0) > 0 THEN direct.nrorc END),
            MAX(CASE WHEN COALESCE(direct.nrorc, 0) > 0 THEN direct.nrorc END),
            MIN(CASE WHEN COALESCE(fonte.nrorc, 0) > 0 THEN fonte.nrorc END)
          ) AS nrorc,
          COALESCE(
            MAX(CASE WHEN TRIM(direct.serier) = '0' AND COALESCE(direct.nrcrm, 0) > 0 THEN direct.pfcrm END),
            MAX(CASE WHEN COALESCE(direct.nrcrm, 0) > 0 THEN direct.pfcrm END),
            MAX(CASE WHEN COALESCE(fonte.nrcrm, 0) > 0 THEN fonte.pfcrm END)
          ) AS pfcrm,
          COALESCE(
            MAX(CASE WHEN TRIM(direct.serier) = '0' AND COALESCE(direct.nrcrm, 0) > 0 THEN direct.ufcrm END),
            MAX(CASE WHEN COALESCE(direct.nrcrm, 0) > 0 THEN direct.ufcrm END),
            MAX(CASE WHEN COALESCE(fonte.nrcrm, 0) > 0 THEN fonte.ufcrm END)
          ) AS ufcrm,
          COALESCE(
            MAX(CASE WHEN TRIM(direct.serier) = '0' AND COALESCE(direct.nrcrm, 0) > 0 THEN direct.nrcrm END),
            MIN(CASE WHEN COALESCE(direct.nrcrm, 0) > 0 THEN direct.nrcrm END),
            MIN(CASE WHEN COALESCE(fonte.nrcrm, 0) > 0 THEN fonte.nrcrm END)
          ) AS nrcrm
        FROM fc12100 direct
        LEFT JOIN fc12100 fonte
          ON fonte.cdfil = direct.cdfil
         AND fonte.nrrqu = direct.nrrqufon
         AND fonte.serier = direct.serierfon
         AND COALESCE(direct.nrrqufon, 0) > 0
        WHERE direct.cdfil = ?
          AND EXISTS (
            SELECT 1
            FROM fc17000 r0
            WHERE r0.cdfil = direct.cdfil
              AND r0.nrrqu = direct.nrrqu
              AND r0.dtefe BETWEEN ? AND ?
              AND COALESCE(r0.vrliq, 0) <> 0
          )
        GROUP BY direct.cdfil, direct.nrrqu
      ) form
        ON form.cdfil = r.cdfil
       AND form.nrrqu = r.nrrqu
      LEFT JOIN fc04000 m
        ON m.pfcrm = form.pfcrm
       AND m.ufcrm = form.ufcrm
       AND m.nrcrm = form.nrcrm
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

    return { sql, params: [unit, start, end, unit, start, end] };
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

    const nrOrcamento = this.parseNrOrcamentoPositivo(get('nr_orcamento'));

    return {
      filial,
      data_pagamento: dataPagamento,
      requisicao,
      cupom,
      nr_orcamento: nrOrcamento,
      qtd_formulas:
        nrOrcamento != null && get('qtd_formulas') != null
          ? Number(get('qtd_formulas'))
          : null,
      valor_orcamento:
        nrOrcamento != null && get('valor_orcamento') != null
          ? Number(get('valor_orcamento'))
          : null,
      valor_requisicao_bruto: Number(get('valor_requisicao_bruto') ?? 0),
      desconto_requisicao: Number(get('desconto_requisicao') ?? 0),
      valor_pago_requisicao: Number(get('valor_pago_requisicao') ?? 0),
      diferenca_calculo: Number(get('diferenca_calculo') ?? 0),
      gap_orcamento_vs_pago:
        nrOrcamento != null && get('gap_orcamento_vs_pago') != null
          ? Number(get('gap_orcamento_vs_pago'))
          : null,
      codigo_vendedor:
        get('codigo_vendedor') != null ? Number(get('codigo_vendedor')) : null,
      vendedor: get('vendedor') ? String(get('vendedor')).trim() : null,
      crm_medico:
        get('crm_medico') != null && String(get('crm_medico')).trim()
          ? String(get('crm_medico')).trim()
          : null,
      uf_crm_medico:
        get('uf_crm_medico') != null && String(get('uf_crm_medico')).trim()
          ? String(get('uf_crm_medico')).trim()
          : null,
      nome_medico: get('nome_medico')
        ? String(get('nome_medico')).trim()
        : null,
      chave_erp: `${filial}-${requisicao}-${cupom}-${dataPagamento}`,
    };
  }

  private parseNrOrcamentoPositivo(value: unknown): number | null {
    if (value == null || value === '') {
      return null;
    }
    const numero = Number(value);
    return Number.isFinite(numero) && numero > 0 ? numero : null;
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

  async buscarMedicosRepresentantes(
    cdcon: number,
    cdfun: number[],
  ): Promise<import('./database.types').PainelMedicoRepresentanteRow[]> {
    if (!cdfun.length) {
      return [];
    }

    const { sql, params } = this.buildMedicosRepresentantesQuery(cdcon, cdfun);
    const options = this.getConnectOptions();
    const charset = this.getDbCharset();

    this.logger.log(
      `Consultando painel médicos: cdcon=${cdcon}, cdfun=[${cdfun.join(',')}]`,
    );

    return new Promise((resolve, reject) => {
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
            this.logger.error(
              'Erro ao executar consulta de painel médicos',
              queryErr,
            );
            return reject(
              new InternalServerErrorException('Erro ao consultar banco.'),
            );
          }

          const rows = (result ?? []).map((row) =>
            this.mapPainelMedicoRepresentanteRow(
              converterObjetoFirebird(row, charset),
            ),
          );
          this.logger.log(`Painel médicos: ${rows.length} registros`);
          resolve(rows);
        });
      });
    });
  }

  private buildMedicosRepresentantesQuery(
    cdcon: number,
    cdfun: number[],
  ): { sql: string; params: Array<string | number> } {
    const placeholders = cdfun.map(() => '?').join(',');
    const sql = `
      SELECT
        TRIM(m.nomemed)                 AS nome_medico,
        TRIM(m.ufcrm)                   AS uf_crm_medico,
        CAST(m.nrcrm AS VARCHAR(20))    AS crm_medico,
        v.cdcon                         AS contrato_representante,
        v.cdfun                         AS codigo_representante,
        TRIM(f.nomefun)                 AS nome_representante
      FROM fc04200 v
      INNER JOIN fc04000 m
        ON m.pfcrm = v.pfcrm
       AND m.ufcrm = v.ufcrm
       AND m.nrcrm = v.nrcrm
      LEFT JOIN fc08000 f
        ON f.cdfun = v.cdfun
       AND f.cdcon = v.cdcon
      WHERE v.cdcon = ?
        AND v.cdfun IN (${placeholders})
      ORDER BY f.nomefun, m.nomemed
    `;

    return { sql, params: [cdcon, ...cdfun] };
  }

  private mapPainelMedicoRepresentanteRow(
    row: Record<string, unknown>,
  ): import('./database.types').PainelMedicoRepresentanteRow {
    const get = (key: string) =>
      row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];

    return {
      nome_medico: String(get('nome_medico') ?? '').trim(),
      uf_crm_medico: String(get('uf_crm_medico') ?? '').trim(),
      crm_medico: String(get('crm_medico') ?? '').trim(),
      contrato_representante: Number(get('contrato_representante') ?? 0),
      codigo_representante: Number(get('codigo_representante') ?? 0),
      nome_representante: String(get('nome_representante') ?? '').trim(),
    };
  }

  async buscarProducaoEtapasResumo(
    unit: number,
    options: {
      start?: string;
      end?: string;
      dataMinimaMovimento?: string;
    },
  ): Promise<import('./database.types').ProducaoEtapaResumoRow[]> {
    const { sql, params } = this.buildProducaoEtapasResumoQuery(unit, options);
    const connectOptions = this.getConnectOptions();
    const charset = this.getDbCharset();

    this.logger.log(
      `Consultando etapas produção: unit=${unit}, modo=${
        options.dataMinimaMovimento ? 'incremental' : 'periodo'
      }`,
    );

    return new Promise((resolve, reject) => {
      Firebird.attach(connectOptions, (attachErr: Error, db: any) => {
        if (attachErr) {
          this.logger.error('Erro ao conectar ao banco', attachErr);
          return reject(
            new InternalServerErrorException('Erro de conexão ao banco.'),
          );
        }

        const consultaInicioMs = Date.now();
        db.query(sql, params, (queryErr: Error, result: any[]) => {
          db.detach();
          this.logger.log(
            `Etapas produção: Firebird respondeu em ${Date.now() - consultaInicioMs}ms (${(result ?? []).length} linha(s) brutas)`,
          );

          if (queryErr) {
            this.logger.error(
              `Erro ao executar consulta de etapas produção: ${queryErr.message}`,
              queryErr,
            );
            return reject(
              new InternalServerErrorException(
                `Erro ao consultar banco: ${queryErr.message}`,
              ),
            );
          }

          const rows: import('./database.types').ProducaoEtapaResumoRow[] = [];
          let mapErros = 0;
          for (const row of result ?? []) {
            try {
              rows.push(
                this.mapProducaoEtapaResumoRow(
                  converterObjetoFirebird(row, charset),
                ),
              );
            } catch (mapErr: unknown) {
              mapErros += 1;
              const msg =
                mapErr instanceof Error ? mapErr.message : String(mapErr);
              this.logger.warn(
                `Etapas produção: falha ao mapear linha (${mapErros}): ${msg}`,
              );
            }
          }
          if (mapErros > 0) {
            this.logger.warn(
              `Etapas produção: ${mapErros} linha(s) ignorada(s) no mapeamento`,
            );
          }

          rows.sort((a, b) => {
            const req = a.requisicao - b.requisicao;
            if (req !== 0) return req;
            const fa = Number(String(a.formula).trim()) || 0;
            const fb = Number(String(b.formula).trim()) || 0;
            if (fa !== fb) return fa - fb;
            const pa = a.posicao_etapa ?? 0;
            const pb = b.posicao_etapa ?? 0;
            if (pa !== pb) return pa - pb;
            return String(a.cod_etapa).localeCompare(String(b.cod_etapa));
          });

          const diagRaw97875 = (result ?? []).filter((row) => {
            const req = Number(
              row.requisicao ?? row.REQUISICAO ?? row.nrrqu ?? row.NRRQU ?? 0,
            );
            return req === 97875;
          });
          const diagRawF9 = diagRaw97875.filter((row) => {
            const f = String(row.formula ?? row.FORMULA ?? '').trim();
            return f === '9' || Number(f) === 9;
          });
          if (
            diagRaw97875.length > 0 ||
            (!options.dataMinimaMovimento &&
              options.start?.startsWith('2026-07'))
          ) {
            this.logger.log(
              `Etapas produção [diag 97875]: SQL bruto=${diagRaw97875.length}, formula9=${diagRawF9.length}, mapeadas=${rows.filter((r) => r.requisicao === 97875).length}, formula9_map=${rows.filter((r) => r.requisicao === 97875 && String(r.formula).trim() === '9').length}`,
            );
          }

          this.logger.log(`Etapas produção: ${rows.length} registros`);
          if (rows.length === 0 && !options.dataMinimaMovimento) {
            this.logger.warn(
              `Etapas produção: 0 registros (unit=${unit}, start=${options.start}, end=${options.end}). Verifique período, cdfil do agente e logs Firebird.`,
            );
          }
          resolve(rows);
        });
      });
    });
  }

  /** `cdusu` pode ser VARCHAR com espaço; evita COALESCE(..., 0) que quebra conversão. */
  private sqlCdusuInteiro(alias: string): string {
    const txt = `NULLIF(TRIM(CAST(${alias}.cdusu AS VARCHAR(32))), '')`;
    return `
      CASE
        WHEN ${txt} IS NOT NULL AND ${txt} SIMILAR TO '[0-9]+'
        THEN CAST(${txt} AS INTEGER)
        ELSE NULL
      END
    `.trim();
  }

  private sqlCdusuInteiroOuZero(alias: string): string {
    const txt = `NULLIF(TRIM(CAST(${alias}.cdusu AS VARCHAR(32))), '')`;
    return `
      CASE
        WHEN ${txt} IS NOT NULL AND ${txt} SIMILAR TO '[0-9]+'
        THEN CAST(${txt} AS INTEGER)
        ELSE 0
      END
    `.trim();
  }

  private sqlCdoperaEntrada(alias: string): string {
    return `TRIM(${alias}.cdopera) IN ('01', '1')`;
  }

  private sqlCdoperaSaida(alias: string): string {
    return `TRIM(${alias}.cdopera) IN ('02', '2')`;
  }

  private sqlCdoperaNaoEntrada(alias: string): string {
    return `TRIM(${alias}.cdopera) NOT IN ('01', '1')`;
  }

  /** Fórmula no ERP pode vir como '9' / '09'; une chaves em formula_touch apenas. */
  private sqlSerierNumerico(alias: string): string {
    return `TRIM(${alias}.serier) SIMILAR TO '[0-9]+'`;
  }

  private sqlSerierInt(alias: string): string {
    return `
      CASE
        WHEN ${this.sqlSerierNumerico(alias)}
        THEN CAST(TRIM(${alias}.serier) AS INTEGER)
        ELSE NULL
      END
    `.trim();
  }

  /** Join por valor bruto — usa índice composto; mesmo tppcp mantém serier consistente. */
  private sqlSerierRawEq(a: string, b: string): string {
    return `${a}.serier = ${b}.serier`;
  }

  /** CRM da fórmula com fallback na mesma requisição (RN-PCP-001). */
  private sqlProducaoEtapasCrmPfcrm(): string {
    return `
      COALESCE(
        CASE WHEN COALESCE(req.nrcrm, 0) > 0 THEN req.pfcrm END,
        (
          SELECT FIRST 1 f.pfcrm
          FROM fc12100 f
          WHERE f.cdfil = stage.cdfil
            AND f.nrrqu = stage.nrrqu
            AND TRIM(f.serier) = '0'
            AND COALESCE(f.nrcrm, 0) > 0
        ),
        (
          SELECT FIRST 1 f.pfcrm
          FROM fc12100 f
          WHERE f.cdfil = stage.cdfil
            AND f.nrrqu = stage.nrrqu
            AND COALESCE(f.nrcrm, 0) > 0
          ORDER BY CAST(TRIM(f.serier) AS INTEGER)
        )
      )
    `.trim();
  }

  private sqlProducaoEtapasCrmUfcrm(): string {
    return `
      COALESCE(
        CASE WHEN COALESCE(req.nrcrm, 0) > 0 THEN req.ufcrm END,
        (
          SELECT FIRST 1 f.ufcrm
          FROM fc12100 f
          WHERE f.cdfil = stage.cdfil
            AND f.nrrqu = stage.nrrqu
            AND TRIM(f.serier) = '0'
            AND COALESCE(f.nrcrm, 0) > 0
        ),
        (
          SELECT FIRST 1 f.ufcrm
          FROM fc12100 f
          WHERE f.cdfil = stage.cdfil
            AND f.nrrqu = stage.nrrqu
            AND COALESCE(f.nrcrm, 0) > 0
          ORDER BY CAST(TRIM(f.serier) AS INTEGER)
        )
      )
    `.trim();
  }

  private sqlProducaoEtapasCrmNrcrm(): string {
    return `
      COALESCE(
        CASE WHEN COALESCE(req.nrcrm, 0) > 0 THEN req.nrcrm END,
        (
          SELECT FIRST 1 f.nrcrm
          FROM fc12100 f
          WHERE f.cdfil = stage.cdfil
            AND f.nrrqu = stage.nrrqu
            AND TRIM(f.serier) = '0'
            AND COALESCE(f.nrcrm, 0) > 0
        ),
        (
          SELECT FIRST 1 f.nrcrm
          FROM fc12100 f
          WHERE f.cdfil = stage.cdfil
            AND f.nrrqu = stage.nrrqu
            AND COALESCE(f.nrcrm, 0) > 0
          ORDER BY CAST(TRIM(f.serier) AS INTEGER)
        )
      )
    `.trim();
  }

  private buildProducaoEtapasResumoQuery(
    unit: number,
    options: {
      start?: string;
      end?: string;
      dataMinimaMovimento?: string;
    },
  ): { sql: string; params: Array<string | number> } {
    const params: Array<string | number> = [unit];
    const cdopEnt = (alias: string) => this.sqlCdoperaEntrada(alias);
    const cdopSai = (alias: string) => this.sqlCdoperaSaida(alias);
    const cdopNaoEnt = (alias: string) => this.sqlCdoperaNaoEntrada(alias);
    const serierInt = (alias: string) => this.sqlSerierInt(alias);
    const serierEq = (a: string, b: string) => this.sqlSerierRawEq(a, b);
    const formulaSelect = `CAST(${serierInt('stage')} AS VARCHAR(10))`;

    let filtroFormulaTouch = 'AND t.data BETWEEN ? AND ?';
    if (options.dataMinimaMovimento) {
      const { data, hora } = this.parseDataHoraMinima(
        options.dataMinimaMovimento,
      );
      filtroFormulaTouch = `
        AND EXISTS (
          SELECT 1
          FROM fc12500 p_evt
          WHERE p_evt.cdfil = t.cdfil
            AND p_evt.nrrqu = t.nrrqu
            AND p_evt.serier = t.serier
            AND (
              p_evt.data > CAST(? AS DATE)
              OR (p_evt.data = CAST(? AS DATE) AND p_evt.hora > CAST(? AS TIME))
            )
        )
      `;
      params.push(data, data, hora);
    } else {
      params.push(options.start ?? '', options.end ?? '');
    }

    params.push(unit, unit, unit, unit);

    const cdusuInt = this.sqlCdusuInteiro('p');
    const cdusuCmp = (a: string, b: string) =>
      `${this.sqlCdusuInteiroOuZero(a)} > ${this.sqlCdusuInteiroOuZero(b)}`;
    const crmPfcrm = this.sqlProducaoEtapasCrmPfcrm();
    const crmUfcrm = this.sqlProducaoEtapasCrmUfcrm();
    const crmNrcrm = this.sqlProducaoEtapasCrmNrcrm();

    const sql = `
      SELECT
        stage.cdfil                                               AS filial,
        stage.nrrqu                                               AS requisicao,
        ${formulaSelect}                                            AS formula,
        TRIM(stage.cdetapa)                                       AS cod_etapa,
        TRIM(e.descricao)                                         AS etapa,
        e.posicao                                                 AS posicao_etapa,
        evt_ent.usuario_entrada                                   AS usuario_entrada,
        evt_sai.usuario_saida                                     AS usuario_saida,
        evt_ent.data_entrada                                      AS data_entrada,
        evt_ent.hora_entrada                                      AS hora_entrada,
        COALESCE(
          evt_sai.data_saida,
          (
            SELECT FIRST 1 p_enc.data
            FROM fc12500 p_enc
            WHERE p_enc.cdfil = stage.cdfil
              AND p_enc.nrrqu = stage.nrrqu
              AND ${serierEq('p_enc', 'stage')}
              AND p_enc.cdetapa = stage.cdetapa
              AND p_enc.tppcp = stage.tppcp
              AND ${cdopNaoEnt('p_enc')}
            ORDER BY p_enc.data, p_enc.hora
          )
        )                                                         AS data_saida,
        COALESCE(
          evt_sai.hora_saida,
          (
            SELECT FIRST 1 p_enc.hora
            FROM fc12500 p_enc
            WHERE p_enc.cdfil = stage.cdfil
              AND p_enc.nrrqu = stage.nrrqu
              AND ${serierEq('p_enc', 'stage')}
              AND p_enc.cdetapa = stage.cdetapa
              AND p_enc.tppcp = stage.tppcp
              AND ${cdopNaoEnt('p_enc')}
            ORDER BY p_enc.data, p_enc.hora
          )
        )                                                         AS hora_saida,
        CASE
          WHEN TRIM(evt_ult.ult_cdopera) IN ('01', '1') THEN 1
          ELSE 0
        END                                                       AS em_andamento_fila,
        evt_ult.usuario_entrada_fila                              AS usuario_entrada_fila,
        evt_ult.data_entrada_fila                                 AS data_entrada_fila,
        evt_ult.hora_entrada_fila                                 AS hora_entrada_fila,
        CASE
          WHEN evt_ent.data_entrada IS NOT NULL
           AND evt_sai.data_saida IS NOT NULL
           AND evt_ent.hora_entrada IS NOT NULL
           AND evt_sai.hora_saida IS NOT NULL
          THEN DATEDIFF(
            MINUTE FROM
            DATEADD(
              MINUTE,
              EXTRACT(HOUR FROM evt_ent.hora_entrada) * 60
              + EXTRACT(MINUTE FROM evt_ent.hora_entrada),
              CAST(evt_ent.data_entrada AS TIMESTAMP)
            )
            TO
            DATEADD(
              MINUTE,
              EXTRACT(HOUR FROM evt_sai.hora_saida) * 60
              + EXTRACT(MINUTE FROM evt_sai.hora_saida),
              CAST(evt_sai.data_saida AS TIMESTAMP)
            )
          )
          ELSE NULL
        END                                                       AS tempo_etapa,
        TRIM(ff.forma_farmaceutica)                               AS forma_farmaceutica,
        req.volume                                                AS quantidade,
        TRIM(req.univol)                                          AS unidade_medida,
        CAST(NULL AS VARCHAR(200))                                AS laboratorio,
        CAST(NULL AS VARCHAR(200))                                AS tipo_formula,
        0                                                         AS qtd_principios_ativos,
        CAST(NULL AS VARCHAR(8000))                               AS principios_ativos,
        CAST(NULL AS VARCHAR(500))                                AS embalagem,
        TRIM(req.nomepa)                                          AS paciente,
        COALESCE(
          CASE WHEN COALESCE(req.cdcli, 0) > 0 THEN req.cdcli END,
          (
            SELECT FIRST 1 f.cdcli
            FROM fc12100 f
            WHERE f.cdfil = stage.cdfil
              AND f.nrrqu = stage.nrrqu
              AND COALESCE(f.cdcli, 0) > 0
            ORDER BY
              CASE WHEN TRIM(f.serier) = '0' THEN 0 ELSE 1 END,
              CAST(TRIM(f.serier) AS INTEGER)
          )
        )                                                         AS codigo_cliente,
        COALESCE(
          (
            SELECT FIRST 1 TRIM(c.nomecli)
            FROM fc07000 c
            WHERE c.cdcli = req.cdcli
              AND c.cdfil = stage.cdfil
              AND COALESCE(req.cdcli, 0) > 0
          ),
          (
            SELECT FIRST 1 TRIM(c.nomecli)
            FROM fc07000 c
            WHERE c.cdcli = req.cdcli
              AND COALESCE(req.cdcli, 0) > 0
            ORDER BY c.cdfil
          ),
          (
            SELECT FIRST 1 TRIM(c.nomecli)
            FROM fc12100 f
            INNER JOIN fc07000 c
              ON c.cdcli = f.cdcli
             AND c.cdfil = f.cdfil
            WHERE f.cdfil = stage.cdfil
              AND f.nrrqu = stage.nrrqu
              AND COALESCE(f.cdcli, 0) > 0
            ORDER BY
              CASE WHEN TRIM(f.serier) = '0' THEN 0 ELSE 1 END,
              CAST(TRIM(f.serier) AS INTEGER)
          )
        )                                                         AS cliente,
        CAST(${crmNrcrm} AS VARCHAR(20))                          AS crf,
        TRIM(${crmUfcrm})                                         AS uf_crf,
        (
          SELECT FIRST 1 TRIM(m.nomemed)
          FROM fc04000 m
          WHERE m.pfcrm = ${crmPfcrm}
            AND m.ufcrm = ${crmUfcrm}
            AND m.nrcrm = ${crmNrcrm}
        )                                                         AS nome_prescritor,
        req.dtentr                                                AS data_retirada,
        req.hrret                                                 AS hora_retirada
      FROM (
        SELECT DISTINCT
          p.cdfil,
          p.nrrqu,
          p.serier,
          p.cdetapa,
          p.tppcp
        FROM fc12500 p
        INNER JOIN (
          SELECT DISTINCT
            t.cdfil,
            t.nrrqu,
            ${serierInt('t')} AS serier_int
          FROM fc12500 t
          WHERE t.cdfil = ?
            AND ${this.sqlSerierNumerico('t')}
            ${filtroFormulaTouch}
        ) formula_touch
          ON formula_touch.cdfil = p.cdfil
         AND formula_touch.nrrqu = p.nrrqu
         AND ${serierInt('p')} = formula_touch.serier_int
        WHERE p.cdfil = ?
          AND ${this.sqlSerierNumerico('p')}
      ) stage
      INNER JOIN (
        SELECT
          p.cdfil,
          p.nrrqu,
          p.serier,
          p.cdetapa,
          p.tppcp,
          ${cdusuInt} AS usuario_entrada,
          p.data AS data_entrada,
          p.hora AS hora_entrada
        FROM fc12500 p
        WHERE ${cdopEnt('p')}
          AND p.cdfil = ?
          AND NOT EXISTS (
            SELECT 1
            FROM fc12500 p_ant
            WHERE p_ant.cdfil = p.cdfil
              AND p_ant.nrrqu = p.nrrqu
              AND ${serierEq('p_ant', 'p')}
              AND p_ant.cdetapa = p.cdetapa
              AND p_ant.tppcp = p.tppcp
              AND ${cdopEnt('p_ant')}
              AND (
                p_ant.data < p.data
                OR (p_ant.data = p.data AND p_ant.hora < p.hora)
                OR (
                  p_ant.data = p.data
                  AND p_ant.hora = p.hora
                  AND ${cdusuCmp('p_ant', 'p')}
                )
              )
          )
      ) evt_ent
        ON evt_ent.cdfil = stage.cdfil
       AND evt_ent.nrrqu = stage.nrrqu
       AND ${serierEq('evt_ent', 'stage')}
       AND evt_ent.cdetapa = stage.cdetapa
       AND evt_ent.tppcp = stage.tppcp
      LEFT JOIN (
        SELECT
          p.cdfil,
          p.nrrqu,
          p.serier,
          p.cdetapa,
          p.tppcp,
          ${cdusuInt} AS usuario_saida,
          p.data AS data_saida,
          p.hora AS hora_saida
        FROM fc12500 p
        WHERE ${cdopSai('p')}
          AND p.cdfil = ?
          AND NOT EXISTS (
            SELECT 1
            FROM fc12500 p_ant
            WHERE p_ant.cdfil = p.cdfil
              AND p_ant.nrrqu = p.nrrqu
              AND ${serierEq('p_ant', 'p')}
              AND p_ant.cdetapa = p.cdetapa
              AND p_ant.tppcp = p.tppcp
              AND ${cdopSai('p_ant')}
              AND (
                p_ant.data < p.data
                OR (p_ant.data = p.data AND p_ant.hora < p.hora)
                OR (
                  p_ant.data = p.data
                  AND p_ant.hora = p.hora
                  AND ${cdusuCmp('p_ant', 'p')}
                )
              )
          )
      ) evt_sai
        ON evt_sai.cdfil = stage.cdfil
       AND evt_sai.nrrqu = stage.nrrqu
       AND ${serierEq('evt_sai', 'stage')}
       AND evt_sai.cdetapa = stage.cdetapa
       AND evt_sai.tppcp = stage.tppcp
      LEFT JOIN (
        SELECT
          p.cdfil,
          p.nrrqu,
          p.serier,
          p.cdetapa,
          p.tppcp,
          TRIM(p.cdopera)                                           AS ult_cdopera,
          CASE
            WHEN ${cdopEnt('p')} THEN ${cdusuInt}
            ELSE NULL
          END                                                       AS usuario_entrada_fila,
          CASE
            WHEN ${cdopEnt('p')} THEN p.data
            ELSE NULL
          END                                                       AS data_entrada_fila,
          CASE
            WHEN ${cdopEnt('p')} THEN p.hora
            ELSE NULL
          END                                                       AS hora_entrada_fila
        FROM fc12500 p
        WHERE p.cdfil = ?
          AND NOT EXISTS (
            SELECT 1
            FROM fc12500 p2
            WHERE p2.cdfil = p.cdfil
              AND p2.nrrqu = p.nrrqu
              AND ${serierEq('p2', 'p')}
              AND p2.cdetapa = p.cdetapa
              AND p2.tppcp = p.tppcp
              AND (
                p2.data > p.data
                OR (p2.data = p.data AND p2.hora > p.hora)
                OR (
                  p2.data = p.data
                  AND p2.hora = p.hora
                  AND ${cdusuCmp('p2', 'p')}
                )
              )
          )
      ) evt_ult
        ON evt_ult.cdfil = stage.cdfil
       AND evt_ult.nrrqu = stage.nrrqu
       AND ${serierEq('evt_ult', 'stage')}
       AND evt_ult.cdetapa = stage.cdetapa
       AND evt_ult.tppcp = stage.tppcp
      LEFT JOIN fc12100 req
        ON req.cdfil  = stage.cdfil
       AND req.nrrqu  = stage.nrrqu
       AND ${serierInt('req')} = ${serierInt('stage')}
      LEFT JOIN fc12540 e
        ON e.cdetapa = stage.cdetapa
       AND e.tppcp   = stage.tppcp
      LEFT JOIN fc12004 ff
        ON ff.codigo = req.tpformafarma
    `;

    const placeholders = sql.match(/\?/g)?.length ?? 0;
    if (placeholders !== params.length) {
      throw new Error(
        `producao_etapas_resumo SQL: placeholders=${placeholders} params=${params.length}`,
      );
    }

    return { sql, params };
  }

  private parseDataHoraMinima(value: string): { data: string; hora: string } {
    const normalizada = value.trim().replace(' ', 'T');
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalizada)) {
      return { data: normalizada, hora: '00:00:00' };
    }
    const [data, horaRaw] = normalizada.split('T');
    const hora = horaRaw?.length === 5 ? `${horaRaw}:00` : (horaRaw ?? '00:00:00');
    return { data, hora: hora.slice(0, 8) };
  }

  private mapProducaoEtapaResumoRow(
    row: Record<string, unknown>,
  ): import('./database.types').ProducaoEtapaResumoRow {
    const get = (key: string) =>
      row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];

    const usuarioEntrada = get('usuario_entrada');
    const usuarioSaida = get('usuario_saida');
    const quantidade = get('quantidade');
    const tempoEtapa = get('tempo_etapa');

    return {
      filial: Number(get('filial') ?? 0),
      requisicao: Number(get('requisicao') ?? 0),
      formula: String(get('formula') ?? '').trim(),
      cod_etapa: String(get('cod_etapa') ?? '').trim(),
      etapa: padronizarDescricaoLegado(String(get('etapa') ?? '').trim()),
      posicao_etapa: Number(get('posicao_etapa') ?? 0),
      usuario_entrada:
        usuarioEntrada != null && usuarioEntrada !== ''
          ? Number(usuarioEntrada)
          : null,
      usuario_saida:
        usuarioSaida != null && usuarioSaida !== ''
          ? Number(usuarioSaida)
          : null,
      data_entrada: get('data_entrada')
        ? this.formatDateField(get('data_entrada'))
        : null,
      hora_entrada: get('hora_entrada')
        ? this.formatTimeField(get('hora_entrada'))
        : null,
      data_saida: get('data_saida')
        ? this.formatDateField(get('data_saida'))
        : null,
      hora_saida: get('hora_saida')
        ? this.formatTimeField(get('hora_saida'))
        : null,
      tempo_etapa:
        tempoEtapa != null && tempoEtapa !== '' ? Number(tempoEtapa) : null,
      forma_farmaceutica: this.normalizarCampoTextoFirebird(
        get('forma_farmaceutica'),
      ),
      quantidade:
        quantidade != null && quantidade !== '' ? Number(quantidade) : null,
      unidade_medida: this.normalizarCampoTextoFirebird(get('unidade_medida')),
      laboratorio: this.normalizarCampoTextoFirebird(get('laboratorio')),
      tipo_formula: this.normalizarCampoTextoFirebird(get('tipo_formula')),
      qtd_principios_ativos: Number(get('qtd_principios_ativos') ?? 0),
      principios_ativos: this.normalizarCampoTextoFirebird(get('principios_ativos')),
      embalagem: this.normalizarCampoTextoFirebird(get('embalagem')),
      paciente: this.normalizarCampoTextoFirebird(get('paciente')),
      codigo_cliente:
        get('codigo_cliente') != null && get('codigo_cliente') !== ''
          ? Number(get('codigo_cliente'))
          : null,
      cliente: this.normalizarCampoTextoFirebird(get('cliente')),
      crf:
        get('crf') != null && String(get('crf')).trim()
          ? String(get('crf')).trim()
          : null,
      uf_crf:
        get('uf_crf') != null && String(get('uf_crf')).trim()
          ? String(get('uf_crf')).trim()
          : null,
      nome_prescritor: this.normalizarCampoTextoFirebird(get('nome_prescritor')),
      data_retirada: get('data_retirada')
        ? this.formatDateField(get('data_retirada'))
        : null,
      hora_retirada: get('hora_retirada')
        ? this.formatTimeField(get('hora_retirada'))
        : null,
      em_andamento_fila:
        get('em_andamento_fila') === 1 ||
        get('em_andamento_fila') === true ||
        get('em_andamento_fila') === '1',
      usuario_entrada_fila: (() => {
        const v = get('usuario_entrada_fila');
        return v != null && v !== '' ? Number(v) : null;
      })(),
      data_entrada_fila: get('data_entrada_fila')
        ? this.formatDateField(get('data_entrada_fila'))
        : null,
      hora_entrada_fila: get('hora_entrada_fila')
        ? this.formatTimeField(get('hora_entrada_fila'))
        : null,
    };
  }

  private normalizarCampoTextoFirebird(value: unknown): string | null {
    if (value == null || value === '') {
      return null;
    }
    if (typeof value === 'function') {
      return null;
    }

    const charset = this.getDbCharset();
    let texto: string;

    if (Buffer.isBuffer(value)) {
      texto = converterTextoFirebird(value, charset);
    } else if (typeof value === 'string') {
      const trimmed = value.trim();
      texto = precisaCorrecaoEncoding(trimmed)
        ? converterTextoFirebird(trimmed, charset)
        : corrigirPadroesGravadosErrados(trimmed);
    } else {
      return null;
    }

    return texto.trim() || null;
  }

  private formatTimeField(value: unknown): string {
    if (!value) return '';
    if (value instanceof Date) {
      const hours = String(value.getHours()).padStart(2, '0');
      const minutes = String(value.getMinutes()).padStart(2, '0');
      const seconds = String(value.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }
    const timeStr = String(value).trim();
    if (/^\d{2}:\d{2}:\d{2}$/.test(timeStr)) {
      return timeStr;
    }
    if (/^\d{2}:\d{2}$/.test(timeStr)) {
      return `${timeStr}:00`;
    }
    return timeStr.slice(0, 8);
  }

  /** RN-PCP-008: exclusões de fórmula (módulo RECEITAS) na janela de datas. */
  async buscarExclusoesReceitas(
    unit: number,
    start: string,
    end: string,
  ): Promise<import('./database.types').ProducaoExclusaoReceitaRow[]> {
    const sql = `
      SELECT
        m.data AS data_exclusao,
        m.hora AS hora_exclusao,
        TRIM(m.cdusu) AS cdusu,
        m.evento AS evento
      FROM fc01m20 m
      WHERE m.data BETWEEN CAST(? AS DATE) AND CAST(? AS DATE)
        AND m.classificacao = 'EXCLUSAO'
        AND m.modulo = 'RECEITAS'
        AND m.evento CONTAINING 'REQUISICAO:'
      ORDER BY m.data, m.hora
    `;
    const params = [start, end];
    const connectOptions = this.getConnectOptions();
    const charset = this.getDbCharset();

    return new Promise((resolve, reject) => {
      Firebird.attach(connectOptions, (attachErr: Error, db: any) => {
        if (attachErr) {
          return reject(
            new InternalServerErrorException('Erro de conexão ao banco.'),
          );
        }

        const t0 = Date.now();
        db.query(sql, params, async (queryErr: Error, result: any[]) => {
          if (queryErr) {
            db.detach();
            return reject(
              new InternalServerErrorException(
                `Erro ao consultar exclusões RECEITAS: ${queryErr.message}`,
              ),
            );
          }

          const parsed: import('./database.types').ProducaoExclusaoReceitaRow[] =
            [];
          for (const row of result ?? []) {
            const converted = converterObjetoFirebird(row, charset);
            const item = parseExclusaoReceitaEvento(
              converted as Record<string, unknown>,
            );
            if (!item || item.filial !== unit) {
              continue;
            }
            parsed.push({
              filial: item.filial,
              requisicao: item.requisicao,
              formula: item.formula,
              data_exclusao: item.data_exclusao,
              hora_exclusao: item.hora_exclusao,
              cdusu: item.cdusu,
              motivo: item.motivo,
              evento: item.evento,
            });
          }

          const dedup = deduplicarExclusoesPorFormula(
            parsed.map((p) => ({
              ...p,
              hora_exclusao: p.hora_exclusao ?? null,
              cdusu: p.cdusu ?? null,
              motivo: p.motivo ?? null,
            })),
          );

          const confirmadas: import('./database.types').ProducaoExclusaoReceitaRow[] =
            [];
          for (const item of dedup) {
            const existe = await this.existeFormulaFc12100(
              db,
              item.filial,
              item.requisicao,
              item.formula,
            );
            if (!existe) {
              confirmadas.push(item);
            }
          }

          db.detach();
          this.logger.log(
            `Exclusões RECEITAS: ${confirmadas.length} fórmula(s) confirmada(s) sem FC12100 (bruto parse=${parsed.length}, dedup=${dedup.length}, ${Date.now() - t0}ms, unit=${unit}, ${start}..${end})`,
          );
          resolve(confirmadas);
        });
      });
    });
  }

  private existeFormulaFc12100(
    db: any,
    cdfil: number,
    nrrqu: number,
    formula: string,
  ): Promise<boolean> {
    const sql = `
      SELECT FIRST 1 1 AS ok
      FROM fc12100 req
      WHERE req.cdfil = ?
        AND req.nrrqu = ?
        AND CAST(TRIM(req.serier) AS INTEGER) = ?
    `;
    const formulaInt = Number(formula);
    return new Promise((resolve, reject) => {
      db.query(
        sql,
        [cdfil, nrrqu, formulaInt],
        (err: Error, rows: { OK?: number; ok?: number }[]) => {
          if (err) {
            reject(err);
            return;
          }
          resolve((rows?.length ?? 0) > 0);
        },
      );
    });
  }
}

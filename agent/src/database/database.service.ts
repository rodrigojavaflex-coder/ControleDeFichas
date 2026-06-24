import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentDbConfig } from '../config/config.types';
import { ValorCompraRow, VendasTotalRow, OrcamentoRow } from './database.types';
import { converterObjetoFirebird } from '../common/encoding.util';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Firebird = require('node-firebird');

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private readonly configService: ConfigService) {}

  async totalVendasDoDia(date: Date, unit: number): Promise<VendasTotalRow[]> {
    const { sql, params } = this.buildQuery(date, unit);
    const options = this.getConnectOptions();
    const charset = this.getDbCharset();

    return new Promise<VendasTotalRow[]>((resolve, reject) => {
      Firebird.attach(options, (attachErr: Error, db: any) => {
        if (attachErr) {
          this.logger.error('Erro ao conectar ao banco', attachErr);
          return reject(new InternalServerErrorException('Erro de conexão ao banco.'));
        }

        db.query(sql, params, (queryErr: Error, result: any[]) => {
          db.detach();

          if (queryErr) {
            this.logger.error('Erro ao executar consulta', queryErr);
            return reject(new InternalServerErrorException('Erro ao consultar banco.'));
          }

          const rows = (result ?? []).map((row) =>
            this.mapRow(converterObjetoFirebird(row, charset)),
          );
          resolve(rows);
        });
      });
    });
  }

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

  private buildQuery(date: Date, unit: number): { sql: string; params: Array<string | number> } {
    const dateParam = this.formatDate(date);
    const params: Array<string | number> = [dateParam, unit];

    const sql = `
      SELECT
        cdfil AS unidade,
        dtope AS data,
        CASE fmpag WHEN '1' THEN 'DINHEIRO' WHEN '4' THEN 'DEPOSITO' WHEN '6' THEN 'CARTAO' ELSE 'OUTRA' END AS forma_pagamento,
        SUM(vrpag) AS total_pago,
        COUNT(*)   AS qtde_linhas
      FROM fc31600
      WHERE dtope = ? AND cdfil = ?
      GROUP BY unidade, data, forma_pagamento
      ORDER BY unidade, data, forma_pagamento
    `;

    return { sql, params };
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

  private mapRow(row: any): VendasTotalRow {
    const get = (key: string) => row[key] ?? row[key.toLowerCase()] ?? row[key.toUpperCase()];

    return {
      unidade: String(get('unidade') ?? ''),
      data: String(get('data') ?? ''),
      forma_pagamento: String(get('forma_pagamento') ?? ''),
      total_pago: Number(get('total_pago') ?? 0),
      qtde_linhas: Number(get('qtde_linhas') ?? 0),
    };
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
        TRIM(cap.nomepa) AS nome_cliente
      FROM fc15100 o
      JOIN fc15000 cap
        ON cap.cdfil = o.cdfil
       AND cap.nrorc = o.nrorc
      JOIN fc08000 v
        ON v.cdfun = o.cdfunre
       AND v.cdcon = o.cdconre
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
}

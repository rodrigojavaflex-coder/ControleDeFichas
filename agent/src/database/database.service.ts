import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentDbConfig } from '../config/config.types';
import { ValorCompraRow, VendasTotalRow } from './database.types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const Firebird = require('node-firebird');

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);

  constructor(private readonly configService: ConfigService) {}

  async totalVendasDoDia(date: Date, unit: number): Promise<VendasTotalRow[]> {
    const { sql, params } = this.buildQuery(date, unit);
    const options = this.getOptions();

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

          const rows = (result ?? []).map((row) => this.mapRow(row));
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
    const options = this.getOptions();

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

          const rows = (result ?? []).map((row) => this.mapValorCompraRow(row));
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

  private getOptions() {
    const dbConfig = this.configService.get<AgentDbConfig>('agent.db');

    if (!dbConfig) {
      throw new InternalServerErrorException('Configuração de banco ausente.');
    }

    if (!dbConfig.path) {
      throw new InternalServerErrorException('DB_PATH não definido.');
    }

    return {
      host: dbConfig.host,
      port: dbConfig.port,
      database: dbConfig.path,
      user: dbConfig.user,
      password: dbConfig.password,
      role: dbConfig.role,
      charset: dbConfig.charset ?? 'UTF8',
      lowercase_keys: true,
    };
  }

  async buscarClientes(
    dataMinima: string,
    unit: number,
  ): Promise<any[]> {
    const { sql, params } = this.buildClientesQuery(dataMinima, unit);
    const options = this.getOptions();

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

          const rows = (result ?? []).map((row) => this.mapClienteRow(row));
          resolve(rows);
        });
      });
    });
  }

  async buscarPrescritores(dataMinima: string): Promise<any[]> {
    const { sql, params } = this.buildPrescritoresQuery(dataMinima);
    const options = this.getOptions();

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

          const rows = (result ?? []).map((row) => this.mapPrescritorRow(row));
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
    const options = this.getOptions();

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
                  this.mapClienteRow(row),
                );
                const prescritores = (result2 ?? []).map((row) =>
                  this.mapPrescritorRow(row),
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
}

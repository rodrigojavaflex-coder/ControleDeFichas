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

  private formatDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }
}

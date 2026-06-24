import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as firebird from 'node-firebird';
import {
  converterObjetoFirebird,
  converterTextoFirebird,
} from '../../common/utils/encoding-legado.util';

@Injectable()
export class FirebirdConnectionService {
  private readonly logger = new Logger(FirebirdConnectionService.name);
  private banco1Config: any;
  private banco2Config: any;

  constructor(private readonly configService: ConfigService) {
    const legacyConfig = this.configService.get('legacyDatabases');
    this.banco1Config = legacyConfig?.banco1;
    this.banco2Config = legacyConfig?.banco2;
  }

  /**
   * Executa query no banco 1 (INHUMAS + NERÓPOLIS)
   */
  async queryBanco1<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const charset = this.banco1Config?.charset || 'NONE';

      const firebirdConfig = { ...this.banco1Config };
      if (charset === 'NONE') {
        delete firebirdConfig.charset;
      }

      firebird.attach(firebirdConfig, (err, db) => {
        if (err) {
          this.logger.error('Erro ao conectar banco 1:', err);
          return reject(err);
        }

        db.query(sql, params, (err, result) => {
          db.detach();
          if (err) {
            this.logger.error('Erro ao executar query banco 1:', err);
            return reject(err);
          }

          const convertedResult = converterObjetoFirebird<T[]>(
            result || [],
            charset,
          );
          resolve(convertedResult);
        });
      });
    });
  }

  /**
   * Executa query no banco 2 (UBERABA)
   */
  async queryBanco2<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const charset = this.banco2Config?.charset || 'NONE';

      const firebirdConfig = { ...this.banco2Config };
      if (charset === 'NONE') {
        delete firebirdConfig.charset;
      }

      firebird.attach(firebirdConfig, (err, db) => {
        if (err) {
          this.logger.error('Erro ao conectar banco 2:', err);
          return reject(err);
        }

        db.query(sql, params, (err, result) => {
          db.detach();
          if (err) {
            this.logger.error('Erro ao executar query banco 2:', err);
            return reject(err);
          }

          const convertedResult = converterObjetoFirebird<T[]>(
            result || [],
            charset,
          );
          resolve(convertedResult);
        });
      });
    });
  }

  /**
   * Determina qual banco usar baseado na unidade
   * INHUMAS (2) e NERÓPOLIS (4) = banco 1
   * UBERABA (2) = banco 2
   */
  getBancoByUnidade(unidade: string): 'banco1' | 'banco2' {
    if (unidade === 'UBERABA') {
      return 'banco2';
    }
    return 'banco1';
  }

  /** Expõe conversão unitária para testes ou uso pontual. */
  convertToUtf8(
    str: string | Buffer | null | undefined,
    sourceCharset: string = 'NONE',
  ): string {
    return converterTextoFirebird(str, sourceCharset);
  }
}

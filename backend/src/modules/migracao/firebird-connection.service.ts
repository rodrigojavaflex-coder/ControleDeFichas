import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as firebird from 'node-firebird';
import * as iconv from 'iconv-lite';

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
   * Converte string de NONE/WIN1252 (ou outro charset) para UTF-8
   * Quando charset é NONE, assume que os dados estão em WIN1252 (padrão Windows brasileiro)
   * Corrige caracteres corrompidos como 'ý' que deveriam ser 'Ç'
   */
  private convertToUtf8(str: string | Buffer | null | undefined, sourceCharset: string = 'NONE'): string {
    if (!str) return '';
    
    // Se charset é NONE, assume WIN1252 (padrão comum em bancos brasileiros)
    const effectiveCharset = sourceCharset === 'NONE' ? 'WIN1252' : sourceCharset;
    
    // Se for Buffer, decodifica diretamente
    if (Buffer.isBuffer(str)) {
      try {
        return iconv.decode(str, effectiveCharset);
      } catch (error) {
        this.logger.warn(`Erro ao decodificar buffer: ${error.message}`);
        return str.toString('utf8'); // Fallback para UTF-8
      }
    }
    
    // Se for string, verifica se precisa converter
    if (typeof str === 'string') {
      // Quando charset é NONE, assume que os dados podem estar em WIN1252 ou ISO-8859-1
      // mas foram interpretados como UTF-8 pelo driver
      try {
        // Primeira tentativa: interpreta a string como bytes em latin1 (preserva bytes)
        // e decodifica usando WIN1252 (padrão brasileiro)
        const buffer = Buffer.from(str, 'latin1');
        
        // Tenta WIN1252 primeiro (mais comum em sistemas brasileiros)
        try {
          const decodedWin1252 = iconv.decode(buffer, 'WIN1252');
          // Verifica se a decodificação melhorou (sem caracteres suspeitos)
          if (!/[ýÿÃ]/g.test(decodedWin1252) || sourceCharset === 'NONE') {
            const fixed = this.fixCorruptedChars(decodedWin1252, 'WIN1252');
            return fixed;
          }
        } catch {}
        
        // Tenta ISO-8859-1 como alternativa
        try {
          const decodedISO8859 = iconv.decode(buffer, 'ISO-8859-1');
          if (!/[ýÿÃ]/g.test(decodedISO8859)) {
            const fixed = this.fixCorruptedChars(decodedISO8859, 'ISO-8859-1');
            return fixed;
          }
        } catch {}
        
        // Se falhou, usa WIN1252 como padrão
        const decoded = iconv.decode(buffer, 'WIN1252');
        return this.fixCorruptedChars(decoded, 'WIN1252');
        
      } catch (error) {
        this.logger.warn(`Erro na conversão de encoding: ${error.message}`);
        // Se falhar, tenta correção manual direta assumindo WIN1252
        return this.fixCorruptedChars(str, 'WIN1252');
      }
    }
    
    return String(str);
  }

  /**
   * Corrige caracteres corrompidos comuns do encoding
   * Trata casos específicos como 'ý' que deveria ser 'Ç' e 'ÇT' que deveria ser 'ÁT' em português
   */
  private fixCorruptedChars(str: string, sourceCharset: string = 'WIN1252'): string {
    if (!str) return str;
    
    let fixed = str;
    
    // Correções simples de substituição
    // 'ý' em UTF-8 (U+00FD) que deveria ser 'Ç' (comum em nomes como GONÇALVES)
    fixed = fixed.replace(/ý/g, 'Ç');
    fixed = fixed.replace(/Ý/g, 'Ç');
    
    // Outros casos comuns de encoding incorreto em português
    fixed = fixed.replace(/Ã§/g, 'Ç'); // 'Ã§' é 'Ç' mal interpretado
    fixed = fixed.replace(/Ã¡/g, 'á'); // 'Ã¡' é 'á' mal interpretado
    fixed = fixed.replace(/Ã©/g, 'é');
    fixed = fixed.replace(/Ã­/g, 'í');
    fixed = fixed.replace(/Ã³/g, 'ó');
    fixed = fixed.replace(/Ãº/g, 'ú');
    fixed = fixed.replace(/Ã£/g, 'ã');
    fixed = fixed.replace(/Ãµ/g, 'õ');
    fixed = fixed.replace(/Ã /g, 'à');
    
    // Tratamento específico para 'Ç' mal posicionado que deveria ser 'Á'
    // Ex: FÇTIMA -> FÁTIMA, MÇTIMA -> MÁTIMA, etc.
    // Em português, 'Ç' geralmente aparece antes de vogais (A, O, E, I, U) ou consoantes L, V, S
    // Quando aparece antes de T, M, N, R, P, provavelmente é 'Á' corrompido
    
    // Preserva casos válidos conhecidos (GONÇALVES, MARÇAL, LUÇA, etc)
    // Verifica se a string contém palavras válidas com cedilha antes de corrigir
    const temPalavraValida = /GONÇAL|MARÇAL|LUÇA|FAÇA|COÇA|REÇA|AÇA|GONÇA|MARÇ|LUÇ|FAÇ|COÇ|REÇ|AÇ/i.test(fixed);
    
    if (!temPalavraValida) {
      // Corrige padrões comuns onde Ç aparece antes de T (muito comum em nomes)
      // FÇTIMA -> FÁTIMA, MÇTIMA -> MÁTIMA, etc.
      fixed = fixed.replace(/ÇTIMA/g, 'ÁTIMA');
      fixed = fixed.replace(/ÇTIMO/g, 'ÁTIMO');
      
      // Corrige qualquer Ç seguido de T (exceto em palavras válidas)
      fixed = fixed.replace(/ÇT([A-Z])/g, 'ÁT$1');
      
      // Corrige padrões onde Ç aparece após consoantes e antes de T, M, N, R, P
      fixed = fixed.replace(/([FMNRL])Ç([TMNRP])/g, '$1Á$2'); // FÇT -> FÁT, MÇT -> MÁT
    } else {
      // Mesmo com palavras válidas, corrige casos específicos problemáticos
      // Se tem ÇT em contexto que não é palavra válida (ex: FÇTIMA dentro de "LEONTINA FÇTIMA")
      if (/ÇTIMA/g.test(fixed)) {
        fixed = fixed.replace(/ÇTIMA/g, 'ÁTIMA');
      }
      if (/ÇTIMO/g.test(fixed)) {
        fixed = fixed.replace(/ÇTIMO/g, 'ÁTIMO');
      }
    }
    
    // Se ainda contém caracteres suspeitos, tenta conversão mais agressiva
    if (/[ýÿÃ]/g.test(fixed)) {
      try {
        // Reinterpreta a string original como bytes em latin1
        // e tenta decodificar novamente com diferentes estratégias
        const originalBytes = Buffer.from(str, 'latin1');
        
        // Tenta decodificar como WIN1252
        try {
          const win1252decoded = iconv.decode(originalBytes, 'WIN1252');
          if (!/[ýÿÃ]/g.test(win1252decoded)) {
            return win1252decoded;
          }
        } catch {}
        
        // Tenta decodificar como ISO-8859-1 (Latin1)
        try {
          const iso88591decoded = iconv.decode(originalBytes, 'ISO-8859-1');
          if (!/[ýÿÃ]/g.test(iso88591decoded)) {
            return iso88591decoded;
          }
        } catch {}
        
      } catch (error) {
        this.logger.warn(`Erro na correção agressiva de encoding: ${error.message}`);
      }
    }
    
    return fixed;
  }

  /**
   * Converte objeto recursivamente de NONE/WIN1252 para UTF-8
   * Quando charset é NONE, assume WIN1252 para conversão
   */
  private convertObjectToUtf8<T>(obj: any, charset: string = 'NONE'): T {
    if (!obj) return obj;
    
    // Para charset NONE, usa WIN1252 como padrão para conversão
    const effectiveCharset = charset === 'NONE' ? 'WIN1252' : charset;
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.convertObjectToUtf8(item, charset)) as T;
    }
    
    if (typeof obj === 'object') {
      const converted: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const convertedKey = this.convertToUtf8(key, charset);
        converted[convertedKey] = typeof value === 'string' 
          ? this.convertToUtf8(value, charset)
          : this.convertObjectToUtf8(value, charset);
      }
      return converted as T;
    }
    
    if (typeof obj === 'string') {
      return this.convertToUtf8(obj, charset) as T;
    }
    
    return obj;
  }

  /**
   * Executa query no banco 1 (INHUMAS + NERÓPOLIS)
   */
  async queryBanco1<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const charset = this.banco1Config?.charset || 'NONE';
      
      // Para charset NONE, não passa o parâmetro charset ao firebird
      // Os dados serão retornados como strings e convertidos depois
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
          
          // Converter resultado de NONE/WIN1252 para UTF-8
          // Quando charset é NONE, assume WIN1252 para conversão
          const convertedResult = this.convertObjectToUtf8<T[]>(result || [], charset);
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
      
      // Para charset NONE, não passa o parâmetro charset ao firebird
      // Os dados serão retornados como strings e convertidos depois
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
          
          // Converter resultado de NONE/WIN1252 para UTF-8
          // Quando charset é NONE, assume WIN1252 para conversão
          const convertedResult = this.convertObjectToUtf8<T[]>(result || [], charset);
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
    // INHUMAS e NERÓPOLIS
    return 'banco1';
  }
}


import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SincronizacaoLogErro,
  SincronizacaoLogNivel,
} from './entities/sincronizacao-log-erro.entity';

export type GravacaoSincronizacaoLog = {
  agente: string;
  etapa: string;
  nivel: SincronizacaoLogNivel;
  mensagem: string;
  detalhe?: string | null;
};

@Injectable()
export class SincronizacaoLogService {
  private readonly logger = new Logger(SincronizacaoLogService.name);

  constructor(
    @InjectRepository(SincronizacaoLogErro)
    private readonly logRepo: Repository<SincronizacaoLogErro>,
  ) {}

  /**
   * Persistência best-effort: falha no log não interrompe a sync.
   */
  async gravar(entrada: GravacaoSincronizacaoLog): Promise<void> {
    try {
      const mensagem = String(entrada.mensagem ?? '').trim().slice(0, 8000);
      if (!mensagem) {
        return;
      }
      const nivel: SincronizacaoLogNivel =
        entrada.nivel === 'info'
          ? 'info'
          : entrada.nivel === 'warn'
            ? 'warn'
            : 'error';
      const row = this.logRepo.create({
        agente: String(entrada.agente ?? '').trim().slice(0, 50) || 'desconhecido',
        etapa: String(entrada.etapa ?? '').trim().slice(0, 80) || 'geral',
        nivel,
        mensagem,
        detalhe: entrada.detalhe
          ? String(entrada.detalhe).trim().slice(0, 16000)
          : null,
      });
      await this.logRepo.save(row);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Falha ao gravar sincronizacao_log_erro: ${msg}`);
    }
  }

  async listar(opcoes?: {
    agente?: string;
    nivel?: SincronizacaoLogNivel;
    limit?: number;
  }): Promise<SincronizacaoLogErro[]> {
    const limit = Math.min(Math.max(opcoes?.limit ?? 200, 1), 500);
    const qb = this.logRepo
      .createQueryBuilder('l')
      .orderBy('l.criadoEm', 'DESC')
      .take(limit);
    const agente = opcoes?.agente?.trim();
    if (agente) {
      qb.andWhere('l.agente = :agente', { agente });
    }
    const nivel = opcoes?.nivel;
    if (nivel === 'info' || nivel === 'warn' || nivel === 'error') {
      qb.andWhere('l.nivel = :nivel', { nivel });
    }
    return qb.getMany();
  }

  async limpar(agente?: string): Promise<{ removidos: number }> {
    if (agente?.trim()) {
      const result = await this.logRepo.delete({ agente: agente.trim() });
      return { removidos: result.affected ?? 0 };
    }
    const result = await this.logRepo
      .createQueryBuilder()
      .delete()
      .from(SincronizacaoLogErro)
      .execute();
    return { removidos: result.affected ?? 0 };
  }
}

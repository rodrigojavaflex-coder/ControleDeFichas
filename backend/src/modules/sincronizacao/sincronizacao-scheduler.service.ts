import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SincronizacaoService } from './sincronizacao.service';
import { SincronizacaoConfigService } from './sincronizacao-config.service';

@Injectable()
export class SincronizacaoSchedulerService {
  private readonly logger = new Logger(SincronizacaoSchedulerService.name);

  constructor(
    private readonly sincronizacaoService: SincronizacaoService,
    private readonly configService: SincronizacaoConfigService,
  ) {}

  /**
   * Job agendado que verifica e executa sincronizações baseado no intervalo configurado
   * Executa a cada 5 minutos para verificar se alguma configuração precisa ser sincronizada
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleSincronizacaoAgendada() {
    this.logger.log('Verificando sincronizações agendadas...');

    try {
      const configs = await this.configService.findAllAtivos();

      if (configs.length === 0) {
        this.logger.debug('Nenhuma configuração de sincronização ativa encontrada');
        return;
      }

      for (const config of configs) {
        const agora = new Date();
        const ultimaExecucao = config.atualizadoEm;
        const intervaloMs = config.intervaloMinutos * 60 * 1000;
        const proximaExecucao = new Date(
          ultimaExecucao.getTime() + intervaloMs,
        );

        if (agora >= proximaExecucao) {
          this.logger.log(
            `Executando sincronização para agente: ${config.agente}`,
          );
          await this.sincronizacaoService.sincronizarAgente(config);
        } else {
          this.logger.debug(
            `Agente ${config.agente} aguardando próximo intervalo`,
          );
        }
      }
    } catch (error: any) {
      // Se a tabela não existir ainda (erro 42P01), apenas loga e continua
      if (error?.code === '42P01' || error?.driverError?.code === '42P01') {
        this.logger.debug(
          'Tabela sincronizacao_config ainda não existe. Execute a migration primeiro.',
        );
        return;
      }
      // Para outros erros, loga como erro
      this.logger.error('Erro ao executar sincronização agendada:', error);
    }
  }
}

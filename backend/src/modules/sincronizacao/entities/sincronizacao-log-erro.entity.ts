import { Entity, Column, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

export type SincronizacaoLogNivel = 'warn' | 'error';

@Entity('sincronizacao_log_erro')
@Index('idx_sincronizacao_log_erro_agente_criado', ['agente', 'criadoEm'])
export class SincronizacaoLogErro extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'log de erro de sincronização';
  }

  @ApiProperty({ example: 'inhumas' })
  @Column({ type: 'varchar', length: 50 })
  agente: string;

  @ApiProperty({ example: 'producao_etapas' })
  @Column({ type: 'varchar', length: 80 })
  etapa: string;

  @ApiProperty({ enum: ['warn', 'error'] })
  @Column({ type: 'varchar', length: 10 })
  nivel: SincronizacaoLogNivel;

  @ApiProperty()
  @Column({ type: 'text' })
  mensagem: string;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'text', nullable: true })
  detalhe?: string | null;
}

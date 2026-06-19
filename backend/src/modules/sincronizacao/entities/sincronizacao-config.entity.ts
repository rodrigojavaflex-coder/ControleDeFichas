import { Entity, Column, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('sincronizacao_config')
@Index(['agente'], { unique: true })
export class SincronizacaoConfig extends BaseEntity {
  /**
   * Nome amigável da entidade para uso em logs de auditoria
   */
  static get nomeAmigavel(): string {
    return 'configuração de sincronização';
  }

  @ApiProperty({
    description: 'Nome do agente',
    example: 'inhumas',
    enum: ['inhumas', 'uberaba', 'neropolis'],
  })
  @Column({ type: 'varchar', length: 50 })
  agente: string;

  @ApiProperty({
    description: 'Última data de busca de clientes',
    example: '2025-01-01',
    required: false,
  })
  @Column({
    type: 'date',
    nullable: true,
    transformer: {
      from: (value: string | null) => value, // Retorna como string YYYY-MM-DD
      to: (value: string | Date | null | undefined) => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (value instanceof Date) return value.toISOString().split('T')[0];
        return null;
      },
    },
  })
  ultimaDataCliente?: Date;

  @ApiProperty({
    description: 'Última data de busca de prescritores',
    example: '2025-01-01',
    required: false,
  })
  @Column({
    type: 'date',
    nullable: true,
    transformer: {
      from: (value: string | null) => value, // Retorna como string YYYY-MM-DD
      to: (value: string | Date | null | undefined) => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (value instanceof Date) return value.toISOString().split('T')[0];
        return null;
      },
    },
  })
  ultimaDataPrescritor?: Date;

  @ApiProperty({
    description: 'Última data/hora de busca de orçamentos (watermark de dtmodificacao)',
    example: '2026-01-01T00:00:00',
    required: false,
  })
  @Column({
    type: 'timestamp',
    nullable: true,
    transformer: {
      from: (value: string | Date | null) => {
        if (value == null) return null;
        if (typeof value === 'string') {
          return value.trim().replace(' ', 'T').slice(0, 19);
        }
        // timestamp without time zone: usar componentes locais (wall-clock gravado)
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
      },
      to: (value: string | Date | null | undefined) => {
        if (!value) return null;
        if (typeof value === 'string') {
          return value.replace('T', ' ').slice(0, 19);
        }
        if (value instanceof Date) {
          const pad = (n: number) => String(n).padStart(2, '0');
          return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
        }
        return null;
      },
    },
  })
  ultimaModificacaoOrcamento?: string | null;

  @ApiProperty({
    description: 'Intervalo em minutos entre sincronizações',
    example: 60,
    default: 60,
  })
  @Column({ type: 'integer', default: 60 })
  intervaloMinutos: number;

  @ApiProperty({
    description: 'Se a sincronização está ativa para este agente',
    example: true,
    default: true,
  })
  @Column({ default: true })
  ativo: boolean;
}

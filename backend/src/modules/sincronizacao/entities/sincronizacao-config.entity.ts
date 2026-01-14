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

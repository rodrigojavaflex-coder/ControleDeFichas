import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('caixa_saldo_inicial_unidade')
export class CaixaSaldoInicialUnidade {
  @ApiProperty({ enum: Unidade })
  @PrimaryColumn({ type: 'varchar', length: 20 })
  unidade: Unidade;

  @ApiProperty({ example: 255.0 })
  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'saldo_inicial',
    default: 0,
    transformer: {
      from: (v: string) => parseFloat(v),
      to: (v: number) => v,
    },
  })
  saldoInicial: number;

  @ApiProperty({ example: '2026-01-01', required: false, nullable: true })
  @Column({
    type: 'date',
    name: 'data_saldo',
    nullable: true,
    transformer: {
      from: (value: string | null) => value,
      to: (value: string | Date | null | undefined) => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (value instanceof Date) return value.toISOString().split('T')[0];
        return null;
      },
    },
  })
  dataSaldo: string | null;

  @UpdateDateColumn({
    type: 'timestamp',
    name: 'atualizado_em',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  atualizadoEm: Date;
}

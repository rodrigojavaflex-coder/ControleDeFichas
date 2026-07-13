import { Column, Entity, Index, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { CaixaFechamentoStatus } from '../enums/caixa-fechamento-status.enum';
import { CaixaFechamentoLinha } from './caixa-fechamento-linha.entity';

@Entity('caixa_fechamento')
@Index('idx_caixa_fechamento_unidade_data', ['unidade', 'dataOperacao'], {
  unique: true,
})
export class CaixaFechamento extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'fechamento de caixa';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 20 })
  unidade: Unidade;

  @ApiProperty({ example: '2025-10-01' })
  @Column({
    type: 'date',
    name: 'data_operacao',
    transformer: {
      from: (value: string) => value,
      to: (value: string | Date) => {
        if (typeof value === 'string') return value;
        if (value instanceof Date) return value.toISOString().split('T')[0];
        return value;
      },
    },
  })
  dataOperacao: string;

  @ApiProperty({ enum: CaixaFechamentoStatus })
  @Column({
    type: 'varchar',
    length: 20,
    default: CaixaFechamentoStatus.RASCUNHO,
  })
  status: CaixaFechamentoStatus;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'saldo_inicial',
    transformer: {
      from: (v: string) => parseFloat(v),
      to: (v: number) => v,
    },
  })
  saldoInicial: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'total_despesas',
    default: 0,
    transformer: {
      from: (v: string) => parseFloat(v),
      to: (v: number) => v,
    },
  })
  totalDespesas: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'total_retirada',
    default: 0,
    transformer: {
      from: (v: string) => parseFloat(v),
      to: (v: number) => v,
    },
  })
  totalRetirada: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    name: 'saldo_final',
    nullable: true,
    transformer: {
      from: (v: string | null) => (v === null ? null : parseFloat(v)),
      to: (v: number | null) => v,
    },
  })
  saldoFinal: number | null;

  @Column({ type: 'timestamp', name: 'confirmado_em', nullable: true })
  confirmadoEm: Date | null;

  @Column({ type: 'uuid', name: 'confirmado_por', nullable: true })
  confirmadoPor: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'text', nullable: true })
  observacao: string | null;

  @OneToMany(() => CaixaFechamentoLinha, (l) => l.fechamento, {
    cascade: true,
  })
  linhas: CaixaFechamentoLinha[];
}

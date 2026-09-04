import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';
import { CaixaRequisicaoPaga } from './caixa-requisicao-paga.entity';

const dateColumnTransformer = {
  from: (value: string) => value,
  to: (value: string | Date) => {
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString().split('T')[0];
    return value;
  },
};

const numericColumnTransformer = {
  from: (value: string) => parseFloat(value),
  to: (value: number) => value,
};

/** Linha FC12100 (SERIER) da paga — crédito do prescritor (RN-VIS-008 / RN-CXA-003). */
@Entity('caixa_requisicao_formula')
@Index('uq_caixa_requisicao_formula_paga_serie', ['requisicaoPagaId', 'serie'], {
  unique: true,
})
@Index('idx_caixa_requisicao_formula_unidade_req', [
  'unidade',
  'numeroRequisicao',
])
@Index('idx_caixa_requisicao_formula_crm', ['crmMedico', 'ufCrmMedico'])
export class CaixaRequisicaoFormula {
  static get nomeAmigavel(): string {
    return 'fórmula da requisição paga';
  }

  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'requisicao_paga_id' })
  requisicaoPagaId: string;

  @ManyToOne(() => CaixaRequisicaoPaga, (p) => p.formulas, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'requisicao_paga_id' })
  requisicaoPaga: CaixaRequisicaoPaga;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 20 })
  unidade: Unidade;

  @ApiProperty()
  @Column({
    type: 'date',
    name: 'data_pagamento',
    transformer: dateColumnTransformer,
  })
  dataPagamento: string;

  @ApiProperty()
  @Column({ type: 'integer', name: 'numero_requisicao' })
  numeroRequisicao: number;

  @ApiProperty({ description: 'FC12100.SERIER (trim).' })
  @Column({ type: 'varchar', length: 10 })
  serie: string;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true, name: 'numero_orcamento' })
  numeroOrcamento?: number | null;

  @ApiProperty({ description: 'FC12100.PRCOBR da série.' })
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    name: 'valor_prcobr',
    transformer: numericColumnTransformer,
  })
  valorPrcobr: number;

  @ApiProperty({
    description:
      'PRCOBR × LEAST(1, VRLIQ/VRRQU) da paga — crédito do prescritor desta série.',
  })
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    name: 'valor_rateado',
    transformer: numericColumnTransformer,
  })
  valorRateado: number;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 500, nullable: true, name: 'nome_medico' })
  nomeMedico?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 20, nullable: true, name: 'crm_medico' })
  crmMedico?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 2, nullable: true, name: 'uf_crm_medico' })
  ufCrmMedico?: string | null;

  @ApiProperty()
  @Column({
    type: 'timestamptz',
    name: 'importado_em',
    default: () => 'CURRENT_TIMESTAMP',
  })
  importadoEm: Date;

  @ApiProperty()
  @Column({
    type: 'timestamptz',
    name: 'atualizado_em',
    default: () => 'CURRENT_TIMESTAMP',
  })
  atualizadoEm: Date;
}

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
import { Orcamento } from '../../orcamentos/entities/orcamento.entity';

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

const nullableNumericColumnTransformer = {
  from: (value: string | null) => (value != null ? parseFloat(value) : null),
  to: (value: number | null) => value,
};

@Entity('caixa_requisicoes_pagas')
@Index('uq_caixa_requisicoes_pagas_chave', ['chaveErp'], { unique: true })
export class CaixaRequisicaoPaga {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 80, name: 'chave_erp' })
  chaveErp: string;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 20 })
  unidade: Unidade;

  @ApiProperty()
  @Column({ type: 'date', name: 'data_pagamento', transformer: dateColumnTransformer })
  dataPagamento: string;

  @ApiProperty()
  @Column({ type: 'integer', name: 'numero_requisicao' })
  numeroRequisicao: number;

  @ApiProperty()
  @Column({ type: 'integer', name: 'numero_cupom' })
  numeroCupom: number;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true, name: 'numero_orcamento' })
  numeroOrcamento?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true, name: 'quantidade_formulas' })
  quantidadeFormulas?: number | null;

  @ApiProperty({ required: false })
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
    name: 'valor_orcamento',
    transformer: nullableNumericColumnTransformer,
  })
  valorOrcamento?: number | null;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    name: 'valor_requisicao_bruto',
    transformer: numericColumnTransformer,
  })
  valorRequisicaoBruto: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    name: 'desconto_requisicao',
    transformer: numericColumnTransformer,
  })
  descontoRequisicao: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    name: 'valor_pago_requisicao',
    transformer: numericColumnTransformer,
  })
  valorPagoRequisicao: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    name: 'diferenca_interna_requisicao',
    transformer: numericColumnTransformer,
  })
  diferencaInternaRequisicao: number;

  @ApiProperty({ required: false })
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
    name: 'diferenca_orcamento_vs_pago',
    transformer: nullableNumericColumnTransformer,
  })
  diferencaOrcamentoVsPago?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true, name: 'codigo_vendedor' })
  codigoVendedor?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 200, nullable: true, name: 'nome_vendedor' })
  nomeVendedor?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 500, nullable: true, name: 'nome_medico' })
  nomeMedico?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 20, nullable: true, name: 'crm_medico' })
  crmMedico?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 2, nullable: true, name: 'uf_crm_medico' })
  ufCrmMedico?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'uuid', nullable: true, name: 'orcamento_id' })
  orcamentoId?: string | null;

  @ManyToOne(() => Orcamento, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'orcamento_id' })
  orcamento?: Orcamento | null;

  @ApiProperty()
  @Column({ type: 'timestamptz', name: 'importado_em', default: () => 'CURRENT_TIMESTAMP' })
  importadoEm: Date;

  @ApiProperty()
  @Column({ type: 'timestamptz', name: 'atualizado_em', default: () => 'CURRENT_TIMESTAMP' })
  atualizadoEm: Date;
}

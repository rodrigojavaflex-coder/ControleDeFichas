import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';
import { CaixaPagamentoErp } from './caixa-pagamento-erp.entity';

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

/**
 * Composição do lote CONVENIO-DINHEIRO (FC17110 / FC14200).
 * Não altera totais do caixa — só enriquece detalhado e comercial (flag).
 */
@Entity('caixa_pagamento_convenio_item')
@Index('uq_caixa_pag_conv_item_chave', ['chaveErp'], { unique: true })
@Index('idx_caixa_pag_conv_item_pag', ['pagamentoId'])
@Index('idx_caixa_pag_conv_item_unidade_data', ['unidade', 'dataRecebimento'])
@Index('idx_caixa_pag_conv_item_req', ['unidade', 'numeroRequisicao'])
export class CaixaPagamentoConvenioItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 120, name: 'chave_erp' })
  chaveErp: string;

  @ApiProperty()
  @Column({ type: 'uuid', name: 'pagamento_id' })
  pagamentoId: string;

  @ManyToOne(() => CaixaPagamentoErp, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'pagamento_id' })
  pagamento: CaixaPagamentoErp;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 20 })
  unidade: Unidade;

  @ApiProperty({ example: '2026-10-30' })
  @Column({
    type: 'date',
    name: 'data_recebimento',
    transformer: dateColumnTransformer,
  })
  dataRecebimento: string;

  @ApiProperty({ enum: ['REQUISICAO', 'PRODUTO'] })
  @Column({ type: 'varchar', length: 20, name: 'tipo_item' })
  tipoItem: 'REQUISICAO' | 'PRODUTO';

  @ApiProperty({ required: false, nullable: true })
  @Column({
    type: 'integer',
    name: 'numero_requisicao',
    nullable: true,
  })
  numeroRequisicao: number | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({
    type: 'integer',
    name: 'numero_cupom_origem',
    nullable: true,
  })
  numeroCupomOrigem: number | null;

  @ApiProperty({
    required: false,
    nullable: true,
    description: 'Nome do produto/revenda (FC03000) — só PRODUTO',
  })
  @Column({
    type: 'varchar',
    length: 500,
    name: 'descricao_item',
    nullable: true,
  })
  descricaoItem: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'integer', name: 'codigo_cliente', nullable: true })
  codigoCliente: number | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({
    type: 'varchar',
    length: 200,
    name: 'nome_cliente',
    nullable: true,
  })
  nomeCliente: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'integer', name: 'codigo_vendedor', nullable: true })
  codigoVendedor: number | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({
    type: 'varchar',
    length: 200,
    name: 'nome_vendedor',
    nullable: true,
  })
  nomeVendedor: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'integer', name: 'codigo_setor', nullable: true })
  codigoSetor: number | null;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    transformer: numericColumnTransformer,
  })
  valor: number;

  @ApiProperty({ required: false, nullable: true })
  @Column({
    type: 'date',
    name: 'data_origem',
    nullable: true,
    transformer: dateColumnTransformer,
  })
  dataOrigem: string | null;

  @Column({
    type: 'timestamptz',
    name: 'importado_em',
    default: () => 'NOW()',
  })
  importadoEm: Date;

  @Column({
    type: 'timestamptz',
    name: 'atualizado_em',
    default: () => 'NOW()',
  })
  atualizadoEm: Date;
}

import {
  Entity,
  Column,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';
import { CaixaItemErp } from './caixa-item-erp.entity';

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

@Entity('caixa_pagamentos_erp')
@Index('uq_caixa_pagamentos_erp_chave', ['chaveErp'], { unique: true })
@Index('idx_caixa_pag_erp_unidade_data', ['unidade', 'dataOperacao'])
export class CaixaPagamentoErp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 80, name: 'chave_erp' })
  chaveErp: string;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 20 })
  unidade: Unidade;

  @ApiProperty({ example: '2025-10-01' })
  @Column({ type: 'date', name: 'data_operacao', transformer: dateColumnTransformer })
  dataOperacao: string;

  @ApiProperty()
  @Column({ type: 'integer', name: 'numero_cupom' })
  numeroCupom: number;

  @ApiProperty()
  @Column({ type: 'integer', name: 'codigo_terminal' })
  codigoTerminal: number;

  @ApiProperty()
  @Column({ type: 'integer', name: 'id_operacao' })
  idOperacao: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 30, name: 'forma_pagamento' })
  formaPagamento: string;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    name: 'valor_pago',
    transformer: numericColumnTransformer,
  })
  valorPago: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    name: 'valor_troco',
    default: 0,
    transformer: numericColumnTransformer,
  })
  valorTroco: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    name: 'valor_liquido',
    transformer: numericColumnTransformer,
  })
  valorLiquido: number;

  @ApiProperty({ required: false })
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
    name: 'total_cupom_bruto',
    transformer: nullableNumericColumnTransformer,
  })
  totalCupomBruto?: number | null;

  @ApiProperty({ required: false })
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
    name: 'total_cupom_liquido',
    transformer: nullableNumericColumnTransformer,
  })
  totalCupomLiquido?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true, name: 'codigo_cliente' })
  codigoCliente?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true, name: 'codigo_operador_caixa' })
  codigoOperadorCaixa?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 200, nullable: true, name: 'nome_operador_caixa' })
  nomeOperadorCaixa?: string | null;

  @ApiProperty()
  @Column({ type: 'timestamptz', name: 'importado_em', default: () => 'CURRENT_TIMESTAMP' })
  importadoEm: Date;

  @ApiProperty()
  @Column({ type: 'timestamptz', name: 'atualizado_em', default: () => 'CURRENT_TIMESTAMP' })
  atualizadoEm: Date;

  @OneToMany(() => CaixaItemErp, (item) => item.pagamento)
  itens?: CaixaItemErp[];
}

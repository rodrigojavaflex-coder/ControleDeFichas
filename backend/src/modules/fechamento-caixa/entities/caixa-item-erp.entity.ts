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
import { CaixaPagamentoErp } from './caixa-pagamento-erp.entity';

export enum CaixaTipoItem {
  REQUISICAO = 'REQUISICAO',
  PRODUTO = 'PRODUTO',
}

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

@Entity('caixa_itens_erp')
@Index('uq_caixa_itens_erp_chave', ['chaveErp'], { unique: true })
export class CaixaItemErp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 80, name: 'chave_erp' })
  chaveErp: string;

  @ApiProperty({ required: false })
  @Column({ type: 'uuid', nullable: true, name: 'pagamento_id' })
  pagamentoId?: string | null;

  @ManyToOne(() => CaixaPagamentoErp, (pagamento) => pagamento.itens, {
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'pagamento_id' })
  pagamento?: CaixaPagamentoErp | null;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 20 })
  unidade: Unidade;

  @ApiProperty()
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
  @Column({ type: 'integer', name: 'sequencia_item' })
  sequenciaItem: number;

  @ApiProperty({ enum: CaixaTipoItem })
  @Column({ type: 'varchar', length: 20, name: 'tipo_item' })
  tipoItem: CaixaTipoItem;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true, name: 'codigo_requisicao_produto' })
  codigoRequisicaoProduto?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true, name: 'numero_requisicao' })
  numeroRequisicao?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 255, nullable: true, name: 'descricao_item' })
  descricaoItem?: string | null;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 4,
    default: 0,
    transformer: numericColumnTransformer,
  })
  quantidade: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    name: 'valor_bruto_item',
    transformer: numericColumnTransformer,
  })
  valorBrutoItem: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    name: 'valor_liquido_item',
    transformer: numericColumnTransformer,
  })
  valorLiquidoItem: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    name: 'desconto_item',
    transformer: numericColumnTransformer,
  })
  descontoItem: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
    name: 'valor_liquido_linha',
    transformer: numericColumnTransformer,
  })
  valorLiquidoLinha: number;

  @ApiProperty()
  @Column({ type: 'timestamptz', name: 'importado_em', default: () => 'CURRENT_TIMESTAMP' })
  importadoEm: Date;

  @ApiProperty()
  @Column({ type: 'timestamptz', name: 'atualizado_em', default: () => 'CURRENT_TIMESTAMP' })
  atualizadoEm: Date;
}

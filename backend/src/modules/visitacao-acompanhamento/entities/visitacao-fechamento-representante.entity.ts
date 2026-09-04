import { Column, Entity, Index, JoinColumn, ManyToOne, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Funcionario } from '../../folha/entities/funcionario.entity';
import { VisitacaoFechamento } from './visitacao-fechamento.entity';
import { VisitacaoFechamentoRepresentanteUnidade } from './visitacao-fechamento-representante-unidade.entity';

const numericToNumber = {
  to: (value: number) => value,
  from: (value: string | null): number =>
    value == null || value === '' ? 0 : Number(value),
};

const nullableNumericToNumber = {
  to: (value: number | null) => value,
  from: (value: string | null): number | null =>
    value == null || value === '' ? null : Number(value),
};

/** Totais oficiais por representante no retrato, com breakdown por filial (RN-VIS-013). */
@Entity('visitacao_fechamento_representante')
@Index('idx_visitacao_fech_rep_fechamento', ['fechamentoId'])
@Index('uq_visitacao_fech_rep_funcionario', ['fechamentoId', 'funcionarioId'], {
  unique: true,
})
export class VisitacaoFechamentoRepresentante extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'representante do fechamento de visitação';
  }

  @Column({ type: 'uuid', name: 'fechamento_id' })
  fechamentoId: string;

  @ManyToOne(() => VisitacaoFechamento, (f) => f.representantes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fechamento_id' })
  fechamento: VisitacaoFechamento;

  @Column({ type: 'uuid', name: 'funcionario_id' })
  funcionarioId: string;

  @ApiProperty({ type: () => Funcionario })
  @ManyToOne(() => Funcionario, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'funcionario_id' })
  funcionario: Funcionario;

  @ApiProperty()
  @Column({ type: 'varchar', length: 200, name: 'nome_representante' })
  nomeRepresentante: string;

  @ApiProperty()
  @Column({ type: 'integer', name: 'contrato_representante' })
  contratoRepresentante: number;

  @ApiProperty()
  @Column({ type: 'integer', name: 'codigo_representante' })
  codigoRepresentante: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    name: 'recebido_loja',
    default: 0,
    transformer: numericToNumber,
  })
  recebidoLoja: number;

  @ApiProperty()
  @Column({ type: 'int', name: 'qtd_recebido', default: 0 })
  quantidadeRecebido: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    name: 'rejeitado_loja',
    default: 0,
    transformer: numericToNumber,
  })
  rejeitadoLoja: number;

  @ApiProperty()
  @Column({ type: 'int', name: 'qtd_rejeitado', default: 0 })
  quantidadeRejeitado: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    name: 'valor_recebido_outras',
    default: 0,
    transformer: numericToNumber,
  })
  valorRecebidoOutras: number;

  @ApiProperty()
  @Column({ type: 'int', name: 'qtd_recebido_outras', default: 0 })
  quantidadeRecebidoOutras: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    name: 'valor_rejeitado_outras',
    default: 0,
    transformer: numericToNumber,
  })
  valorRejeitadoOutras: number;

  @ApiProperty()
  @Column({ type: 'int', name: 'qtd_rejeitado_outras', default: 0 })
  quantidadeRejeitadoOutras: number;

  @ApiProperty({ enum: Unidade, isArray: true })
  @Column({
    type: 'varchar',
    array: true,
    name: 'unidades_comissao',
    default: () => "'{}'",
  })
  unidadesComissao: Unidade[];

  @ApiProperty({ required: false })
  @Column({
    type: 'numeric',
    precision: 9,
    scale: 4,
    nullable: true,
    name: 'representatividade',
    transformer: nullableNumericToNumber,
  })
  representatividade?: number | null;

  @ApiProperty({ required: false })
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    name: 'valor_meta',
    transformer: nullableNumericToNumber,
  })
  valorMeta?: number | null;

  @ApiProperty({ required: false })
  @Column({
    type: 'numeric',
    precision: 9,
    scale: 4,
    nullable: true,
    name: 'percentual_meta',
    transformer: nullableNumericToNumber,
  })
  percentualMeta?: number | null;

  @ApiProperty({ required: false })
  @Column({
    type: 'numeric',
    precision: 9,
    scale: 4,
    nullable: true,
    name: 'percentual_faixa',
    transformer: nullableNumericToNumber,
  })
  percentualFaixa?: number | null;

  @ApiProperty({ required: false })
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    nullable: true,
    name: 'valor_comissao',
    transformer: nullableNumericToNumber,
  })
  valorComissao?: number | null;

  @ApiProperty()
  @Column({ type: 'int', name: 'qtd_com_movimento', default: 0 })
  qtdComMovimento: number;

  @ApiProperty()
  @Column({ type: 'int', name: 'qtd_ativos_painel', default: 0 })
  qtdAtivosPainel: number;

  @ApiProperty()
  @Column({ type: 'int', name: 'qtd_fora_atendimento', default: 0 })
  qtdForaAtendimento: number;

  @OneToMany(
    () => VisitacaoFechamentoRepresentanteUnidade,
    (u) => u.fechamentoRepresentante,
    { cascade: true },
  )
  unidadesRecebido: VisitacaoFechamentoRepresentanteUnidade[];
}

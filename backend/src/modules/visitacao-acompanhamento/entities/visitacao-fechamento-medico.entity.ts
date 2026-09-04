import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Funcionario } from '../../folha/entities/funcionario.entity';
import { VisitacaoFechamento } from './visitacao-fechamento.entity';

const numericToNumber = {
  to: (value: number) => value,
  from: (value: string | null): number =>
    value == null || value === '' ? 0 : Number(value),
};

/** Linha da grade (por unidade de movimento) no retrato (RN-VIS-013). */
@Entity('visitacao_fechamento_medico')
@Index('idx_visitacao_fech_medico_fechamento', ['fechamentoId'])
@Index('idx_visitacao_fech_medico_fech_recebido', ['fechamentoId', 'recebidoLoja'])
@Index('idx_visitacao_fech_medico_crm', ['crmMedico', 'ufCrmMedico'])
@Index(
  'uq_visitacao_fech_medico_crm_unidade',
  ['fechamentoId', 'crmMedico', 'ufCrmMedico', 'unidade'],
  { unique: true },
)
export class VisitacaoFechamentoMedico extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'médico do fechamento de visitação';
  }

  @Column({ type: 'uuid', name: 'fechamento_id' })
  fechamentoId: string;

  @ManyToOne(() => VisitacaoFechamento, (f) => f.medicos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fechamento_id' })
  fechamento: VisitacaoFechamento;

  @ApiProperty({ required: false, type: () => Funcionario })
  @ManyToOne(() => Funcionario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'funcionario_id' })
  funcionario?: Funcionario | null;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty({ enum: Unidade, required: false, nullable: true })
  @Column({
    type: 'varchar',
    length: 32,
    name: 'unidade_carteira',
    nullable: true,
  })
  unidadeCarteira?: Unidade | null;

  @ApiProperty()
  @Column({ type: 'boolean', name: 'movimento_fora_carteira', default: false })
  movimentoForaCarteira: boolean;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20, name: 'crm_medico' })
  crmMedico: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 2, name: 'uf_crm_medico' })
  ufCrmMedico: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 500, name: 'nome_medico' })
  nomeMedico: string;

  @ApiProperty({ required: false, nullable: true })
  @Column({
    type: 'varchar',
    length: 200,
    name: 'nome_representante',
    nullable: true,
  })
  nomeRepresentante?: string | null;

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
  @Column({ type: 'boolean', name: 'na_carteira', default: false })
  naCarteira: boolean;
}

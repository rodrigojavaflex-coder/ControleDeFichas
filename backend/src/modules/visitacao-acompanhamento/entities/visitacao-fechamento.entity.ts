import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { VisitacaoFechamentoStatus } from '../enums/visitacao-fechamento-status.enum';
import { VisitacaoFechamentoCarteira } from './visitacao-fechamento-carteira.entity';
import { VisitacaoFechamentoRepresentante } from './visitacao-fechamento-representante.entity';
import { VisitacaoFechamentoMedico } from './visitacao-fechamento-medico.entity';
import { VisitacaoFechamentoOutraUnidade } from './visitacao-fechamento-outra-unidade.entity';

const dateColumnTransformer = {
  from: (value: string) => value,
  to: (value: string | Date) => {
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString().split('T')[0];
    return value;
  },
};

const numericToNumber = {
  to: (value: number) => value,
  from: (value: string | null): number =>
    value == null || value === '' ? 0 : Number(value),
};

/** Retrato mensal da visitação por unidade (RN-VIS-013). Ausência da linha = competência aberta. */
@Entity('visitacao_fechamento')
@Index('uq_visitacao_fechamento_unidade_ano_mes', ['unidade', 'ano', 'mes'], {
  unique: true,
})
export class VisitacaoFechamento extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'fechamento de visitação';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty()
  @Column({ type: 'int' })
  ano: number;

  @ApiProperty()
  @Column({ type: 'int' })
  mes: number;

  @ApiProperty({ enum: VisitacaoFechamentoStatus })
  @Column({ type: 'varchar', length: 20, default: VisitacaoFechamentoStatus.FECHADO })
  status: VisitacaoFechamentoStatus;

  @ApiProperty({ description: 'Último dia útil da competência (gate RN-CAL-001).' })
  @Column({
    type: 'date',
    name: 'data_ultimo_dia_util',
    transformer: dateColumnTransformer,
  })
  dataUltimoDiaUtil: string;

  @ApiProperty({ description: 'Recebido Loja congelado (RN-VIS-008).' })
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
  @Column({ type: 'int', name: 'qtd_recebido_loja', default: 0 })
  quantidadeRecebidoLoja: number;

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
  @Column({ type: 'int', name: 'qtd_rejeitado_loja', default: 0 })
  quantidadeRejeitadoLoja: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    name: 'recebido_outras',
    default: 0,
    transformer: numericToNumber,
  })
  recebidoOutras: number;

  @ApiProperty()
  @Column({ type: 'int', name: 'qtd_recebido_outras', default: 0 })
  quantidadeRecebidoOutras: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    name: 'rejeitado_outras',
    default: 0,
    transformer: numericToNumber,
  })
  rejeitadoOutras: number;

  @ApiProperty()
  @Column({ type: 'int', name: 'qtd_rejeitado_outras', default: 0 })
  quantidadeRejeitadoOutras: number;

  @ApiProperty()
  @Column({ type: 'timestamp', name: 'fechado_em' })
  fechadoEm: Date;

  @ApiProperty({ required: false, type: () => Usuario })
  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fechado_por_id' })
  fechadoPor?: Usuario | null;

  @OneToMany(() => VisitacaoFechamentoCarteira, (c) => c.fechamento, {
    cascade: true,
  })
  carteira: VisitacaoFechamentoCarteira[];

  @OneToMany(() => VisitacaoFechamentoRepresentante, (r) => r.fechamento, {
    cascade: true,
  })
  representantes: VisitacaoFechamentoRepresentante[];

  @OneToMany(() => VisitacaoFechamentoOutraUnidade, (o) => o.fechamento, {
    cascade: true,
  })
  outrasUnidades: VisitacaoFechamentoOutraUnidade[];

  @OneToMany(() => VisitacaoFechamentoMedico, (m) => m.fechamento, {
    cascade: true,
  })
  medicos: VisitacaoFechamentoMedico[];
}

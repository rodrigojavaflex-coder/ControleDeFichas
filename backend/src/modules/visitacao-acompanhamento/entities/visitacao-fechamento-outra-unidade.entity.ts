import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { VisitacaoFechamento } from './visitacao-fechamento.entity';

const numericToNumber = {
  to: (value: number) => value,
  from: (value: string | null): number =>
    value == null || value === '' ? 0 : Number(value),
};

/** Bloco de outra filial no card TOTAL do retrato (RN-VIS-013). */
@Entity('visitacao_fechamento_outra_unidade')
@Index('idx_visitacao_fech_outra_fechamento', ['fechamentoId'])
@Index('uq_visitacao_fech_outra_unidade', ['fechamentoId', 'unidade'], {
  unique: true,
})
export class VisitacaoFechamentoOutraUnidade extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'outra unidade do fechamento de visitação';
  }

  @Column({ type: 'uuid', name: 'fechamento_id' })
  fechamentoId: string;

  @ManyToOne(() => VisitacaoFechamento, (f) => f.outrasUnidades, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fechamento_id' })
  fechamento: VisitacaoFechamento;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    name: 'valor_recebido',
    default: 0,
    transformer: numericToNumber,
  })
  valorRecebido: number;

  @ApiProperty()
  @Column({ type: 'int', name: 'qtd_recebido', default: 0 })
  quantidadeRecebido: number;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    name: 'valor_rejeitado',
    default: 0,
    transformer: numericToNumber,
  })
  valorRejeitado: number;

  @ApiProperty()
  @Column({ type: 'int', name: 'qtd_rejeitado', default: 0 })
  quantidadeRejeitado: number;
}

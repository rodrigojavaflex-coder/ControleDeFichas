import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { VisitacaoFechamentoRepresentante } from './visitacao-fechamento-representante.entity';

const numericToNumber = {
  to: (value: number) => value,
  from: (value: string | null): number =>
    value == null || value === '' ? 0 : Number(value),
};

/** Recebido do representante por filial de comissão no retrato (RN-VIS-013). */
@Entity('visitacao_fechamento_representante_unidade')
@Index('idx_visitacao_fech_rep_unid_rep', ['fechamentoRepresentanteId'])
@Index('uq_visitacao_fech_rep_unid', ['fechamentoRepresentanteId', 'unidade'], {
  unique: true,
})
export class VisitacaoFechamentoRepresentanteUnidade extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'unidade de comissão do representante no fechamento';
  }

  @Column({ type: 'uuid', name: 'fechamento_representante_id' })
  fechamentoRepresentanteId: string;

  @ManyToOne(() => VisitacaoFechamentoRepresentante, (r) => r.unidadesRecebido, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'fechamento_representante_id' })
  fechamentoRepresentante: VisitacaoFechamentoRepresentante;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty()
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericToNumber,
  })
  valor: number;

  @ApiProperty()
  @Column({ type: 'int', default: 0 })
  quantidade: number;
}

import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Funcionario } from '../../folha/entities/funcionario.entity';

const numericToNumber = {
  to: (value: number) => value,
  from: (value: string | null): number =>
    value == null || value === '' ? 0 : Number(value),
};

const numericToNumberOrNull = {
  to: (value: number | null) => value,
  from: (value: string | null): number | null =>
    value == null || value === '' ? null : Number(value),
};

@Entity('visitacao_comissao_faixa')
@Index('idx_visitacao_comissao_faixa_ordem', ['ordem'])
@Index('idx_visitacao_comissao_faixa_funcionario', ['funcionario'])
export class VisitacaoComissaoFaixa extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'faixa de comissão';
  }

  @ApiProperty({ type: () => Funcionario })
  @ManyToOne(() => Funcionario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'funcionarioId' })
  funcionario: Funcionario;

  @ApiProperty({ example: 80, description: '% da meta (início, inclusive)' })
  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    transformer: numericToNumber,
  })
  percentualMetaDe: number;

  @ApiProperty({
    required: false,
    example: 89.99,
    description: '% da meta (fim, inclusive). Nulo = sem teto.',
  })
  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    transformer: numericToNumberOrNull,
  })
  percentualMetaAte: number | null;

  @ApiProperty({ example: 1.5, description: '% de comissão da faixa' })
  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    transformer: numericToNumber,
  })
  percentualComissao: number;

  @ApiProperty({ example: 2 })
  @Column({ type: 'integer', default: 0 })
  ordem: number;
}

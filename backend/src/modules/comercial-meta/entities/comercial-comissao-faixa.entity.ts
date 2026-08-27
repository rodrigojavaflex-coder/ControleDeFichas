import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ComercialTipoBase } from '../../../common/enums/comercial-tipo-base.enum';
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

@Entity('comercial_comissao_faixa')
@Index('idx_comercial_comissao_faixa_func_tipo', ['funcionario', 'tipoBase'])
@Index('idx_comercial_comissao_faixa_ordem', ['ordem'])
export class ComercialComissaoFaixa extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'faixa de comissão comercial';
  }

  @ApiProperty({ type: () => Funcionario })
  @ManyToOne(() => Funcionario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'funcionarioId' })
  funcionario: Funcionario;

  @ApiProperty({ enum: ComercialTipoBase })
  @Column({ type: 'varchar', length: 20 })
  tipoBase: ComercialTipoBase;

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

  @ApiProperty({
    example: 150,
    description: 'Bônus em R$ ao atingir a faixa. 0 = sem bônus.',
  })
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericToNumber,
  })
  valorBonus: number;

  @ApiProperty({ example: 2 })
  @Column({ type: 'integer', default: 0 })
  ordem: number;
}

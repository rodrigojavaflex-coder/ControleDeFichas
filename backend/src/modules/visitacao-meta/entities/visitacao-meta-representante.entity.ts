import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Funcionario } from '../../folha/entities/funcionario.entity';

const numericToNumber = {
  to: (value: number) => value,
  from: (value: string | null): number =>
    value == null || value === '' ? 0 : Number(value),
};

@Entity('visitacao_meta_representante')
@Unique('uq_visitacao_meta_func_ano_mes', ['funcionario', 'anoMes'])
@Index('idx_visitacao_meta_unidade_ano_mes', ['unidade', 'anoMes'])
export class VisitacaoMetaRepresentante extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'meta de visitação';
  }

  @ApiProperty({ type: () => Funcionario })
  @ManyToOne(() => Funcionario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'funcionarioId' })
  funcionario: Funcionario;

  @ApiProperty({ example: '2026-08', description: 'Competência YYYY-MM' })
  @Column({ type: 'varchar', length: 7 })
  anoMes: string;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty({ example: 50000 })
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericToNumber,
  })
  valorMeta: number;
}

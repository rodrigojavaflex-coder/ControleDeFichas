import { Entity, Column, Index, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('producao_jornada_dia')
@Unique('uq_producao_jornada_dia_unidade_dia', ['unidade', 'diaSemana'])
@Index('idx_producao_jornada_dia_unidade', ['unidade'])
export class ProducaoJornadaDia extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'dia da jornada de produção';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty({ minimum: 0, maximum: 6 })
  @Column({ type: 'smallint' })
  diaSemana: number;

  @ApiProperty({ default: true })
  @Column({ type: 'boolean', default: true })
  fechado: boolean;
}

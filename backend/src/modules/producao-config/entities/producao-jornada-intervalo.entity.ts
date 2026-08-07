import { Entity, Column, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('producao_jornada_intervalo')
@Index('idx_producao_jornada_int_unidade_dia', ['unidade', 'diaSemana', 'ordem'])
export class ProducaoJornadaIntervalo extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'intervalo de jornada de produção';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  /** 0 = domingo … 6 = sábado (Date.getDay()). */
  @ApiProperty({ minimum: 0, maximum: 6 })
  @Column({ type: 'smallint' })
  diaSemana: number;

  @ApiProperty()
  @Column({ type: 'smallint', default: 0 })
  ordem: number;

  @ApiProperty({ example: '08:00' })
  @Column({ type: 'varchar', length: 8 })
  horaInicio: string;

  @ApiProperty({ example: '18:00' })
  @Column({ type: 'varchar', length: 8 })
  horaFim: string;
}

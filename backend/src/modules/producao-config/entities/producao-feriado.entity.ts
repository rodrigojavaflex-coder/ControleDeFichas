import { Entity, Column, Index, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

export enum ProducaoFeriadoOrigem {
  MANUAL = 'manual',
  NACIONAL = 'nacional',
}

@Entity('producao_feriado')
@Unique('uq_producao_feriado_unidade_data', ['unidade', 'data'])
@Index('idx_producao_feriado_unidade_data', ['unidade', 'data'])
export class ProducaoFeriado extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'feriado de produção';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty({ example: '2026-09-07' })
  @Column({ type: 'varchar', length: 10 })
  data: string;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 200, nullable: true })
  descricao?: string | null;

  @ApiProperty({ enum: ProducaoFeriadoOrigem })
  @Column({ type: 'varchar', length: 16, default: ProducaoFeriadoOrigem.MANUAL })
  origem: ProducaoFeriadoOrigem;
}

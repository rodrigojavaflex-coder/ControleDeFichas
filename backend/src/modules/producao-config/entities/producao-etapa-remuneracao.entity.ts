import { Entity, Column, Index, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('producao_etapa_remuneracao')
@Unique('uq_producao_etapa_remuneracao_unidade_cod', ['unidade', 'codEtapa'])
@Index('idx_producao_etapa_rem_unidade_pos', ['unidade', 'posicaoEtapa'])
export class ProducaoEtapaRemuneracao extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'remuneração de etapa de produção';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20 })
  codEtapa: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 200 })
  etapa: string;

  @ApiProperty()
  @Column({ type: 'integer', default: 0 })
  posicaoEtapa: number;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  recebe: boolean;

  @ApiProperty({ default: 0 })
  @Column({ type: 'numeric', precision: 15, scale: 4, default: 0 })
  valor: string;
}

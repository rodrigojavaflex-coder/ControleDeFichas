import { Entity, Column, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('producao_jornada_unidade')
@Unique('uq_producao_jornada_unidade', ['unidade'])
export class ProducaoJornadaUnidade extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'jornada de produção (unidade)';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  configurado: boolean;
}

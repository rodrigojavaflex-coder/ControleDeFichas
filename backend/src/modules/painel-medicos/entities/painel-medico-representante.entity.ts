import { Entity, Column, Index, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('painel_medicos_representantes')
@Unique('uq_painel_medico_rep', [
  'unidade',
  'crmMedico',
  'ufCrmMedico',
  'contratoRepresentante',
  'codigoRepresentante',
])
@Index('idx_painel_unidade_rep', ['unidade', 'contratoRepresentante', 'codigoRepresentante'])
export class PainelMedicoRepresentante extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'painel médico representante';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 20 })
  unidade: Unidade;

  @ApiProperty()
  @Column({ type: 'varchar', length: 500 })
  nomeMedico: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 2 })
  ufCrmMedico: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20 })
  crmMedico: string;

  @ApiProperty()
  @Column({ type: 'integer' })
  contratoRepresentante: number;

  @ApiProperty()
  @Column({ type: 'integer' })
  codigoRepresentante: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 500 })
  nomeRepresentante: string;
}

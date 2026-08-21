import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('calendario_unidade')
export class CalendarioUnidade {
  static get nomeAmigavel(): string {
    return 'calendário da unidade';
  }

  @ApiProperty({ enum: Unidade })
  @PrimaryColumn({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty({
    description:
      'Se verdadeiro, sábado conta como dia útil no calendário da unidade (visitação). Independente da jornada de produção.',
  })
  @Column({ type: 'boolean', default: false })
  sabadoDiaUtil: boolean;

  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  criadoEm: Date;

  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  atualizadoEm: Date;
}

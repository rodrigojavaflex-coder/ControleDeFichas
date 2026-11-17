import { Column, Entity } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('visita_cores_dias')
export class VisitaCorDia extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'cor dos dias da visita';
  }

  @ApiProperty({ example: 5, description: 'A cor vale quando os dias da visita são maiores que este número.' })
  @Column({ name: 'dias_acima_de', type: 'int' })
  diasAcimaDe: number;

  @ApiProperty({ example: '#F5C518' })
  @Column({ type: 'varchar', length: 7 })
  cor: string;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty({ default: true })
  @Column({ default: true })
  ativo: boolean;
}

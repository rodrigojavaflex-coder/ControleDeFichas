import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('tipos_visita')
export class TipoVisita extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'tipo de visita';
  }

  @ApiProperty({ example: 'Apresentação', maxLength: 80 })
  @Column({ length: 80 })
  nome: string;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty({ default: true })
  @Column({ default: true })
  ativo: boolean;
}

import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('folha_cargo')
export class FolhaCargo extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'cargo (folha)';
  }

  @ApiProperty()
  @Column({ length: 120 })
  descricao: string;

  @ApiProperty({ default: true })
  @Column({ default: true })
  ativo: boolean;
}

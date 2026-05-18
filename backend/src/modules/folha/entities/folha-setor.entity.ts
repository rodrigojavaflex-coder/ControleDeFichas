import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('folha_setor')
export class FolhaSetor extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'setor (folha)';
  }

  @ApiProperty()
  @Column({ length: 120 })
  descricao: string;

  @ApiProperty({ default: true })
  @Column({ default: true })
  ativo: boolean;
}

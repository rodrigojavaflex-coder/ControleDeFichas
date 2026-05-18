import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('folha_tipo')
export class FolhaTipo extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'tipo de folha';
  }

  @ApiProperty()
  @Column({ length: 120 })
  descricao: string;

  @ApiProperty({ default: true })
  @Column({ default: true })
  ativo: boolean;

  @ApiProperty({ default: 0 })
  @Column({ type: 'int', default: 0 })
  ordenacao: number;

  /** Se true, a tela de lançamento permite carregar capas para todos os elegíveis da competência de uma só vez. */
  @ApiProperty({ default: false })
  @Column({ default: false })
  folhaMensal: boolean;
}

import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('orcamento_motivo_rejeicao')
export class OrcamentoMotivoRejeicao extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'motivo de rejeição de orçamento';
  }

  @ApiProperty()
  @Column({ length: 200 })
  descricao: string;

  @ApiProperty({ default: true })
  @Column({ default: true })
  ativo: boolean;
}

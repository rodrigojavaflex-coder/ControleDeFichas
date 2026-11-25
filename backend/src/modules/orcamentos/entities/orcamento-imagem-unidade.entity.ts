import { Entity, Column, Unique, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

export enum OrcamentoImagemFaixaTipo {
  TOPO = 'TOPO',
  RODAPE = 'RODAPE',
}

@Entity('orcamento_imagem_unidade')
@Unique('uq_orcamento_imagem_unidade_tipo', ['unidade', 'tipo'])
@Index('idx_orcamento_imagem_unidade', ['unidade'])
export class OrcamentoImagemUnidade extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'imagem do orçamento';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 20 })
  unidade: Unidade;

  @ApiProperty({ enum: OrcamentoImagemFaixaTipo })
  @Column({ type: 'varchar', length: 10 })
  tipo: OrcamentoImagemFaixaTipo;

  /** PNG da faixa. Não entra no select padrão. */
  @Column({ type: 'bytea', select: false })
  imagem: Buffer;

  @Column({ type: 'varchar', length: 100, select: false })
  mime: string;
}

import { Column, Entity, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { ComercialTipoBase } from '../../../common/enums/comercial-tipo-base.enum';

const numericToNumber = {
  to: (value: number) => value,
  from: (value: string | null): number =>
    value == null || value === '' ? 0 : Number(value),
};

@Entity('comercial_meta_unidade')
@Unique('uq_comercial_meta_unidade_ano_mes_tipo', [
  'unidade',
  'anoMes',
  'tipoBase',
])
export class ComercialMetaUnidade extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'meta comercial da unidade';
  }

  @ApiProperty({ example: '2026-08', description: 'Competência YYYY-MM' })
  @Column({ type: 'varchar', length: 7 })
  anoMes: string;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty({ enum: ComercialTipoBase })
  @Column({ type: 'varchar', length: 20 })
  tipoBase: ComercialTipoBase;

  @ApiProperty({ example: 150000 })
  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    default: 0,
    transformer: numericToNumber,
  })
  valorMeta: number;
}

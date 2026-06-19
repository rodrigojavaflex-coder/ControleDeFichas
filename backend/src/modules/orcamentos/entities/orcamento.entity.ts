import { Entity, Column, Index, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { OrcamentoStatus } from '../../../common/enums/orcamento-status.enum';

@Entity('orcamentos')
@Unique('uq_orcamentos_unidade_nrorc_serieo', ['unidade', 'nrorc', 'serieo'])
@Index('idx_orcamentos_unidade_data', ['unidade', 'dataOrcamento'])
@Index('idx_orcamentos_status', ['status'])
@Index('idx_orcamentos_ultima_modificacao', ['ultimaModificacao'])
export class Orcamento extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'orçamento';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 20 })
  unidade: Unidade;

  @ApiProperty()
  @Column({ type: 'integer' })
  cdfil: number;

  @ApiProperty()
  @Column({ type: 'integer' })
  nrorc: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 10 })
  serieo: string;

  @ApiProperty({ example: '12345-A' })
  @Column({ type: 'varchar', length: 30 })
  nrOrcamento: string;

  @ApiProperty({ example: '2026-06-18' })
  @Column({
    type: 'date',
    transformer: {
      from: (value: string | null) => value,
      to: (value: string | Date | null | undefined) => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (value instanceof Date) {
          if (isNaN(value.getTime())) return null;
          return value.toISOString().split('T')[0];
        }
        return null;
      },
    },
  })
  dataOrcamento: string;

  @ApiProperty({ enum: OrcamentoStatus })
  @Column({ type: 'varchar', length: 20 })
  status: OrcamentoStatus;

  @ApiProperty()
  @Column({ type: 'numeric', precision: 15, scale: 2 })
  precoVenda: number;

  @ApiProperty()
  @Column({ type: 'numeric', precision: 15, scale: 2 })
  precoCobrado: number;

  @ApiProperty()
  @Column({ type: 'numeric', precision: 15, scale: 2, default: 0 })
  descontoFormula: number;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true })
  codigoCliente?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 500, nullable: true })
  nomeCliente?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true })
  codigoVendedor?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 500, nullable: true })
  nomeVendedor?: string | null;

  @ApiProperty()
  @Column({ type: 'timestamp' })
  ultimaModificacao: Date;
}

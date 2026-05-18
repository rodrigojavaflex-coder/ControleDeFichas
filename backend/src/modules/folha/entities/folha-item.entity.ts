import { Entity, Column, ManyToOne, JoinColumn, Unique, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { FolhaCapa } from './folha-capa.entity';
import { FolhaVerba } from './folha-verba.entity';

@Entity('folha_item')
@Unique(['folhaCapa', 'folhaVerba'])
@Index('idx_folha_item_capa', ['folhaCapa'])
export class FolhaItem extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'folha item';
  }

  @ApiProperty({ type: () => FolhaCapa })
  @ManyToOne(() => FolhaCapa, (c) => c.itens, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'folhaCapaId' })
  folhaCapa: FolhaCapa;

  @ApiProperty({ type: () => FolhaVerba })
  @ManyToOne(() => FolhaVerba, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'folhaVerbaId' })
  folhaVerba: FolhaVerba;

  @ApiProperty({ example: '1500.00' })
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  valor: string;

  /** Referência / quantidade do lançamento (ex.: horas, dias, unidades) — não altera o cálculo do valor lançado. */
  @ApiProperty({ example: '1.0000' })
  @Column({ type: 'decimal', precision: 14, scale: 4, default: 1 })
  quantidade: string;
}

import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { TipoDaBaixa } from '../../../common/enums/baixa.enum';
import { Venda } from '../../vendas/entities/venda.entity';

@Entity('baixas')
export class Baixa extends BaseEntity {
  /**
   * Nome amigável da entidade para uso em logs de auditoria
   */
  static get nomeAmigavel(): string {
    return 'baixa';
  }

  @ApiProperty({
    description: 'ID da venda relacionada',
    example: 'uuid-da-venda',
  })
  @Column('uuid')
  idvenda: string;

  @ManyToOne(() => Venda)
  @JoinColumn({ name: 'idvenda' })
  venda: Venda;

  @ApiProperty({
    description: 'Tipo da baixa',
    example: TipoDaBaixa.DINHEIRO,
    enum: TipoDaBaixa,
  })
  @Column({
    type: 'enum',
    enum: TipoDaBaixa,
  })
  tipoDaBaixa: TipoDaBaixa;

  @ApiProperty({
    description: 'Valor da baixa',
    example: 500.00,
  })
  @Column({ 
    type: 'decimal', 
    precision: 10, 
    scale: 2,
    transformer: {
      from: (value: string) => parseFloat(value),
      to: (value: number) => value,
    }
  })
  valorBaixa: number;

  @ApiProperty({
    description: 'Data da baixa',
    example: '2025-10-27',
  })
  @Column({
    type: 'date',
    transformer: {
      from: (value: string) => value, // Retorna como string YYYY-MM-DD
      to: (value: string | Date) => {
        if (typeof value === 'string') return value;
        if (value instanceof Date) return value.toISOString().split('T')[0];
        return value;
      }
    }
  })
  dataBaixa: Date;

  @ApiProperty({
    description: 'Observação da baixa',
    example: 'Pagamento realizado em dinheiro',
    maxLength: 500,
    required: false,
  })
  @Column({ length: 500, nullable: true })
  observacao?: string;
}
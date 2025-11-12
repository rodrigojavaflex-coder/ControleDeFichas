import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { VendaOrigem, VendaStatus } from '../../../common/enums/venda.enum';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('vendas')
export class Venda extends BaseEntity {
  /**
   * Nome amigável da entidade para uso em logs de auditoria
   */
  static get nomeAmigavel(): string {
    return 'venda';
  }

  @ApiProperty({
    description: 'Protocolo da venda',
    example: 'VND-2025-001',
    maxLength: 30,
  })
  @Column({ length: 30 })
  protocolo: string;

  @ApiProperty({
    description: 'Data da venda',
    example: '2025-10-25',
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
  dataVenda: Date;

  @ApiProperty({
    description: 'Data do fechamento da venda',
    example: '2025-10-30',
    required: false,
  })
  @Column({ 
    type: 'date',
    nullable: true,
    transformer: {
      from: (value: string | null) => value,
      to: (value: string | Date | null | undefined) => {
        if (!value) return null;
        if (typeof value === 'string') return value;
        if (value instanceof Date) return value.toISOString().split('T')[0];
        return null;
      }
    }
  })
  dataFechamento?: Date | null;

  @ApiProperty({
    description: 'Nome do cliente',
    example: 'João da Silva',
    maxLength: 300,
  })
  @Column({ length: 300 })
  cliente: string;

  @ApiProperty({
    description: 'Origem da venda',
    example: VendaOrigem.GOIANIA,
    enum: VendaOrigem,
  })
  @Column({
    type: 'enum',
    enum: VendaOrigem,
  })
  origem: VendaOrigem;

  @ApiProperty({
    description: 'Nome do vendedor',
    example: 'Maria Santos',
    maxLength: 300,
  })
  @Column({ length: 300 })
  vendedor: string;

  @ApiProperty({
    description: 'Valor da compra',
    example: 1500.50,
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
  valorCompra: number;

  @ApiProperty({
    description: 'Valor pago pelo cliente',
    example: 1500.50,
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
  valorCliente: number;

  @ApiProperty({
    description: 'Observação da venda',
    example: 'Venda realizada com sucesso',
    maxLength: 30,
  })
  @Column({ length: 30, nullable: true })
  observacao?: string;

  @ApiProperty({
    description: 'Status da venda',
    example: VendaStatus.REGISTRADO,
    enum: VendaStatus,
  })
  @Column({
    type: 'enum',
    enum: VendaStatus,
    default: VendaStatus.REGISTRADO,
  })
  status: VendaStatus;

  @ApiProperty({
    description: 'Unidade da venda',
    example: 'INHUMAS',
    enum: Unidade,
    required: false,
  })
  @Column({
    type: 'enum',
    enum: Unidade,
    nullable: true,
  })
  unidade?: Unidade;

  @ApiProperty({
    description: 'Status ativo da venda',
    example: 'Venda ativa',
    maxLength: 300,
    required: false,
  })
  @Column({ length: 300, nullable: true })
  ativo?: string;
}

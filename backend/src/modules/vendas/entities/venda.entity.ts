import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { VendaOrigem, VendaStatus, TipoAtualizacao } from '../../../common/enums/venda.enum';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Cliente } from '../../clientes/entities/cliente.entity';
import { Vendedor } from '../../vendedores/entities/vendedor.entity';
import { Prescritor } from '../../prescritores/entities/prescritor.entity';

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
    description: 'Data de envio (opcional)',
    example: '2025-11-05',
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
      },
    },
  })
  dataEnvio?: Date | null;

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
    description: 'Valor da compra',
    example: 1500.50,
    required: false,
  })
  @Column({ 
    type: 'decimal', 
    precision: 10, 
    scale: 2,
    nullable: true,
    transformer: {
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
      to: (value: number | null | undefined) => (value === null || value === undefined ? null : value),
    }
  })
  valorCompra?: number | null;

  @ApiProperty({
    description: 'Valor pago (total recebido)',
    example: 1500.50,
    required: false,
  })
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
    transformer: {
      from: (value: string | null) => (value === null ? null : parseFloat(value)),
      to: (value: number | null | undefined) => (value === null || value === undefined ? null : value),
    },
  })
  valorPago?: number | null;

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
    maxLength: 500,
  })
  @Column({ length: 500, nullable: true })
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

  @ApiProperty({
    description: 'Tipo de atualização do valor de compra',
    example: TipoAtualizacao.FORMULA_CERTA_AGENTE,
    enum: TipoAtualizacao,
    required: false,
  })
  @Column({
    type: 'enum',
    enum: TipoAtualizacao,
    nullable: true,
  })
  tipoAtualizacao?: TipoAtualizacao;

  // Relacionamentos
  @ApiProperty({
    description: 'Cliente relacionado',
    type: () => Cliente,
  })
  @ManyToOne(() => Cliente, { nullable: false })
  @JoinColumn({ name: 'clienteId' })
  cliente: Cliente;

  @ApiProperty({
    description: 'Vendedor relacionado',
    type: () => Vendedor,
  })
  @ManyToOne(() => Vendedor, { nullable: false })
  @JoinColumn({ name: 'vendedorId' })
  vendedor: Vendedor;

  @ApiProperty({
    description: 'Prescritor relacionado',
    type: () => Prescritor,
    required: false,
  })
  @ManyToOne(() => Prescritor, { nullable: true })
  @JoinColumn({ name: 'prescritorId' })
  prescritor?: Prescritor;
}

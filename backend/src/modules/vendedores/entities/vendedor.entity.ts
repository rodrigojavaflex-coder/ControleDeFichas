import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('vendedores')
export class Vendedor extends BaseEntity {
  /**
   * Nome amigável da entidade para uso em logs de auditoria
   */
  static get nomeAmigavel(): string {
    return 'vendedor';
  }

  @ApiProperty({
    description: 'Nome do vendedor',
    example: 'Maria Santos',
    maxLength: 500,
  })
  @Column({ length: 500 })
  nome: string;

  @ApiProperty({
    description: 'Código do vendedor no sistema de produção',
    example: 54321,
    required: false,
  })
  @Column({ type: 'integer', nullable: true })
  cdVendedor?: number;

  @ApiProperty({
    description: 'Unidade do vendedor',
    example: Unidade.INHUMAS,
    enum: Unidade,
  })
  @Column({
    type: 'enum',
    enum: Unidade,
  })
  unidade: Unidade;
}


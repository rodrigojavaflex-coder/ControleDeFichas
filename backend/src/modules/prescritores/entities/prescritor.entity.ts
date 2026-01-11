import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('prescritores')
export class Prescritor extends BaseEntity {
  /**
   * Nome amigável da entidade para uso em logs de auditoria
   */
  static get nomeAmigavel(): string {
    return 'prescritor';
  }

  @ApiProperty({
    description: 'Nome do prescritor',
    example: 'Dr. João Almeida',
    maxLength: 500,
  })
  @Column({ length: 500 })
  nome: string;

  @ApiProperty({
    description: 'Número do CRM do prescritor',
    example: 12345,
    required: false,
  })
  @Column({ type: 'integer', nullable: true })
  numeroCRM?: number;

  @ApiProperty({
    description: 'UF do CRM do prescritor',
    example: 'GO',
    maxLength: 2,
    required: false,
  })
  @Column({ length: 2, nullable: true })
  UFCRM?: string;
}


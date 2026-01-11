import { Entity, Column } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('clientes')
export class Cliente extends BaseEntity {
  /**
   * Nome amigável da entidade para uso em logs de auditoria
   */
  static get nomeAmigavel(): string {
    return 'cliente';
  }

  @ApiProperty({
    description: 'Nome do cliente',
    example: 'João da Silva',
    maxLength: 500,
  })
  @Column({ length: 500 })
  nome: string;

  @ApiProperty({
    description: 'Código do cliente no sistema de produção',
    example: 12345,
    required: false,
  })
  @Column({ type: 'integer', nullable: true })
  cdcliente?: number;

  @ApiProperty({
    description: 'CPF do cliente',
    example: '123.456.789-00',
    maxLength: 14,
    required: false,
  })
  @Column({ length: 14, nullable: true })
  cpf?: string;

  @ApiProperty({
    description: 'Data de nascimento do cliente',
    example: '1980-05-15',
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
        if (value instanceof Date) {
          // Valida se é uma data válida antes de converter
          if (isNaN(value.getTime())) {
            return null;
          }
          return value.toISOString().split('T')[0];
        }
        return null;
      },
    },
  })
  dataNascimento?: Date | null;

  @ApiProperty({
    description: 'Email do cliente',
    example: 'joao@email.com',
    required: false,
  })
  @Column({ length: 255, nullable: true })
  email?: string;

  @ApiProperty({
    description: 'Telefone do cliente',
    example: '(62) 99999-9999',
    required: false,
  })
  @Column({ length: 20, nullable: true })
  telefone?: string;

  @ApiProperty({
    description: 'Unidade do cliente',
    example: Unidade.INHUMAS,
    enum: Unidade,
  })
  @Column({
    type: 'enum',
    enum: Unidade,
  })
  unidade: Unidade;
}


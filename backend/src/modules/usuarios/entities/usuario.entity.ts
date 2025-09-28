import { Entity, Column, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../../../common/enums/permission.enum';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('usuarios')
@Index(['email'], { unique: true })
export class Usuario extends BaseEntity {
  /**
   * Nome amigável da entidade para uso em logs de auditoria
   */
  static get nomeAmigavel(): string {
    return 'usuário';
  }

  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'João da Silva',
  })
  @Column({ length: 100 })
  nome: string;

  @ApiProperty({
    description: 'Email único do usuário',
    example: 'joao@email.com',
  })
  @Column({ unique: true, length: 100 })
  email: string;

  @ApiProperty({
    description: 'Senha do usuário (hash)',
    example: 'hashed-password',
  })
  @Column({ nullable: false })
  senha: string;

  @ApiProperty({
    description: 'Status ativo do usuário',
    example: true,
    default: true,
  })
  @Column({ default: true })
  ativo: boolean;

  @ApiProperty({
    description: 'Permissões do usuário',
    example: ['user:read', 'user:create'],
    isArray: true,
  })
  @Column('simple-array', { default: '' })
  permissoes: Permission[];

  @ApiProperty({
    description: 'Tema preferido do usuário',
    example: 'Claro',
    default: 'Claro',
    enum: ['Claro', 'Escuro'],
  })
  @Column({ default: 'Claro', length: 10 })
  tema: string;
}

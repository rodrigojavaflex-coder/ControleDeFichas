import { Entity, Column, Index, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../../../common/enums/permission.enum';

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @ApiProperty({
    description: 'ID único do usuário',
    example: 'uuid-v4-string',
  })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'João da Silva',
  })
  @Column({ length: 100 })
  name: string;

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
  password: string;

  @ApiProperty({
    description: 'Status ativo do usuário',
    example: true,
    default: true,
  })
  @Column({ default: true })
  isActive: boolean;

  @ApiProperty({
    description: 'Permissões do usuário',
    example: ['user:read', 'user:create'],
    isArray: true,
  })
  @Column('simple-array', { default: '' })
  permissions: Permission[];

  @ApiProperty({
    description: 'Data de criação',
  })
  @CreateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Data da última atualização',
  })
  @UpdateDateColumn({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP(6)',
    onUpdate: 'CURRENT_TIMESTAMP(6)',
  })
  updatedAt: Date;
}
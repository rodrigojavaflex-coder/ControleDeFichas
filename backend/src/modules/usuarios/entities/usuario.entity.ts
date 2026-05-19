import {
  Entity,
  Column,
  Index,
  ManyToOne,
  ManyToMany,
  JoinColumn,
  JoinTable,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Perfil } from '../../perfil/entities/perfil.entity';
import { Vendedor } from '../../vendedores/entities/vendedor.entity';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

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

  @ApiProperty({ description: 'Perfis do usuário', type: () => [Perfil] })
  @ManyToMany(() => Perfil, (perfil) => perfil.usuarios, { eager: true })
  @JoinTable({
    name: 'usuarios_perfis',
    joinColumn: { name: 'usuario_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'perfil_id', referencedColumnName: 'id' },
  })
  perfis: Perfil[];

  @ApiProperty({
    description: 'Tema preferido do usuário',
    example: 'Claro',
    default: 'Claro',
    enum: ['Claro', 'Escuro'],
  })
  @Column({ default: 'Claro', length: 10 })
  tema: string;

  @ApiProperty({
    description: 'IDs dos atalhos da tela inicial (ordem do usuário)',
    example: ['vendas', 'folha-lancamentos'],
    required: false,
    type: [String],
  })
  @Column({ name: 'atalhos_home', type: 'jsonb', nullable: true })
  atalhosHome: string[] | null;

  @ApiProperty({
    description: 'Unidade do usuário',
    example: 'INHUMAS',
    enum: Unidade,
  })
  @Column({
    type: 'enum',
    enum: Unidade,
    nullable: true,
  })
  unidade?: Unidade;

  @ApiProperty({ description: 'Vendedor associado ao usuário', type: () => Vendedor, required: false })
  @ManyToOne(() => Vendedor, { nullable: true, eager: false })
  @JoinColumn({ name: 'vendedorId' })
  vendedor?: Vendedor;
}

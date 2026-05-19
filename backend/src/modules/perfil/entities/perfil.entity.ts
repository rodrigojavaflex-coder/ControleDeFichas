import { Entity, Column, Index, ManyToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Permission } from '../../../common/enums/permission.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('perfil')
@Index(['nomePerfil'], { unique: true })
export class Perfil extends BaseEntity {

  @ApiProperty({ description: 'Nome único do perfil', example: 'ADMIN' })
  @Column({ unique: true })
  nomePerfil: string;

  @ApiProperty({ description: 'Permissões associadas ao perfil', example: ['user:read', 'user:create'], isArray: true })
  @Column('simple-array')
  permissoes: Permission[];

  @ManyToMany(() => Usuario, (usuario) => usuario.perfis)
  usuarios?: Usuario[];
}
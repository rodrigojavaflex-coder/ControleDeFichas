import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  Unique,
  OneToMany,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Funcionario } from './funcionario.entity';
import { FolhaTipo } from './folha-tipo.entity';
import { FolhaItem } from './folha-item.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('folha_capa')
@Unique(['funcionario', 'ano', 'mes', 'folhaTipo'])
@Index('idx_folha_capa_competencia', ['ano', 'mes'])
@Index('idx_folha_capa_funcionario_competencia', [
  'funcionario',
  'ano',
  'mes',
  'folhaTipo',
])
export class FolhaCapa extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'folha capa';
  }

  @ApiProperty({ type: () => Funcionario })
  @ManyToOne(() => Funcionario, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'funcionarioId' })
  funcionario: Funcionario;

  @ApiProperty()
  @Column({ type: 'int' })
  ano: number;

  @ApiProperty()
  @Column({ type: 'int' })
  mes: number;

  @ApiProperty({ type: () => FolhaTipo })
  @ManyToOne(() => FolhaTipo, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'folhaTipoId' })
  folhaTipo: FolhaTipo;

  @ApiProperty({ description: 'Capa congelada: sem alteração de itens na tela de lançamento.' })
  @Column({ type: 'boolean', default: false })
  congelada: boolean;

  @ApiProperty({ required: false, nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  congeladaEm?: Date | null;

  @ApiProperty({ type: () => Usuario, required: false, nullable: true })
  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'congeladaPorId' })
  congeladaPor?: Usuario | null;

  @OneToMany(() => FolhaItem, (i) => i.folhaCapa, { cascade: false })
  itens?: FolhaItem[];
}

import { Entity, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { FolhaTipo } from './folha-tipo.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('folha_fechamento')
@Unique(['ano', 'mes', 'folhaTipo', 'unidade'])
@Index('idx_folha_fechamento_lookup', ['unidade', 'ano', 'mes'])
export class FolhaFechamento extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'fechamento de folha';
  }

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

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  /** Momento da abertura vigente (registro inicial ou após Reabrir). */
  @ApiProperty({ required: false })
  @Column({ type: 'timestamp', nullable: true })
  abertaEm?: Date | null;

  @ApiProperty()
  @Column({ default: false })
  fechado: boolean;

  @ApiProperty({ required: false })
  @Column({ type: 'timestamp', nullable: true })
  fechadoEm?: Date | null;

  @ApiProperty({ required: false, type: () => Usuario })
  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'fechadoPorId' })
  fechadoPor?: Usuario | null;
}

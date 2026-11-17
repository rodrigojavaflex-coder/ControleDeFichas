import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Prescritor } from '../../prescritores/entities/prescritor.entity';
import { TipoPendencia } from '../../tipos-pendencia/entities/tipo-pendencia.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { Visita } from '../../visitas/entities/visita.entity';
import { StatusSolicitacao } from '../enums/status-solicitacao.enum';

@Entity('solicitacoes')
export class Solicitacao extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'solicitação';
  }

  @ApiProperty()
  @Column({ type: 'text' })
  texto: string;

  @ApiProperty({ enum: StatusSolicitacao })
  @Column({ type: 'varchar', length: 20, default: StatusSolicitacao.ABERTA })
  status: StatusSolicitacao;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  tipoPendenciaId: string | null;

  @ManyToOne(() => TipoPendencia, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'tipoPendenciaId' })
  tipoPendencia?: TipoPendencia | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  visitaId: string | null;

  @ManyToOne(() => Visita, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'visitaId' })
  visita?: Visita | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  prescritorId: string | null;

  @ManyToOne(() => Prescritor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'prescritorId' })
  prescritor?: Prescritor | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  visitadorId: string | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'visitadorId' })
  visitador?: Usuario | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  unidade: string | null;
}

import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Visita } from './visita.entity';

@Entity('visitas_midias')
@Index('idx_visitas_midias_visita', ['visitaId'])
export class VisitaMidia extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'mídia da visita';
  }

  @ApiProperty()
  @Column({ type: 'uuid' })
  visitaId: string;

  @ManyToOne(() => Visita, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visitaId' })
  visita?: Visita;

  @ApiProperty({ enum: ['imagem', 'audio', 'documento'] })
  @Column({ type: 'varchar', length: 20 })
  tipo: 'imagem' | 'audio' | 'documento';

  @Column({ type: 'varchar', length: 255 })
  nomeArquivo: string;

  @Column({ type: 'varchar', length: 120 })
  mimeType: string;

  @Column({ type: 'bigint' })
  tamanho: number;

  @Column({ type: 'bytea', select: false })
  dadosBytea: Buffer;

  @Column({ type: 'integer', nullable: true })
  duracaoMs: number | null;
}

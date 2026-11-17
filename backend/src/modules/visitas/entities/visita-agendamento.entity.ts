import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Prescritor } from '../../prescritores/entities/prescritor.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

const dateTransformer = {
  from: (value: string | null) => value,
  to: (value: string | Date | null | undefined) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return value.toISOString().split('T')[0];
    }
    return null;
  },
};

@Entity('visita_agendamentos')
@Index('idx_visita_agendamentos_usuario_data', ['usuarioId', 'data'])
export class VisitaAgendamento extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'agendamento de visita';
  }

  @ApiProperty()
  @Column({ type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'usuarioId' })
  usuario?: Usuario;

  @ApiProperty()
  @Column({ type: 'uuid' })
  prescritorId: string;

  @ManyToOne(() => Prescritor, { nullable: false })
  @JoinColumn({ name: 'prescritorId' })
  prescritor?: Prescritor;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty({ description: 'YYYY-MM-DD (America/Sao_Paulo)' })
  @Column({ type: 'date', transformer: dateTransformer })
  data: string;

  @ApiPropertyOptional({ nullable: true, description: 'HH:mm' })
  @Column({ type: 'varchar', length: 5, nullable: true })
  hora: string | null;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'text', nullable: true })
  observacao: string | null;
}

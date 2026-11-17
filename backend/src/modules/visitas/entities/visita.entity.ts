import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Prescritor } from '../../prescritores/entities/prescritor.entity';
import { TipoVisita } from '../../tipos-visita/entities/tipo-visita.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { StatusVisita } from '../enums/status-visita.enum';

@Entity('visitas')
export class Visita extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'visita';
  }

  @ApiProperty()
  @Column({ type: 'uuid' })
  prescritorId: string;

  @ManyToOne(() => Prescritor, { nullable: false })
  @JoinColumn({ name: 'prescritorId' })
  prescritor?: Prescritor;

  @ApiProperty()
  @Column({ type: 'uuid' })
  tipoVisitaId: string;

  @ManyToOne(() => TipoVisita, { nullable: false })
  @JoinColumn({ name: 'tipoVisitaId' })
  tipoVisita?: TipoVisita;

  @ApiProperty()
  @Column({ type: 'uuid' })
  usuarioId: string;

  @ManyToOne(() => Usuario, { nullable: false })
  @JoinColumn({ name: 'usuarioId' })
  usuario?: Usuario;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @Column({ type: 'double precision' })
  latitudeInicio: number;

  @Column({ type: 'double precision' })
  longitudeInicio: number;

  @Column({ type: 'timestamptz' })
  dataHoraInicio: Date;

  @Column({ type: 'timestamptz', nullable: true })
  dataHoraFim: Date | null;

  @ApiProperty({ enum: StatusVisita })
  @Column({ type: 'varchar', length: 20 })
  status: StatusVisita;

  @Column({ type: 'text', nullable: true })
  descricao: string | null;

  @Column({ type: 'text', nullable: true })
  pendencia: string | null;

  @Column({ type: 'text', nullable: true })
  material: string | null;
}

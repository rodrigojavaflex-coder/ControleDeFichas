import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Usuario } from '../../usuarios/entities/usuario.entity';

@Entity('tipos_pendencia')
export class TipoPendencia extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'tipo de pendência';
  }

  @ApiProperty({ example: 'Contato médico', maxLength: 80 })
  @Column({ length: 80 })
  nome: string;

  @ApiProperty({ example: 'Ligação ou retorno ao prescritor' })
  @Column({ type: 'text' })
  descricao: string;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty()
  @Column({ type: 'uuid' })
  responsavelId: string;

  @ManyToOne(() => Usuario, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'responsavelId' })
  responsavel?: Usuario;

  @ApiProperty({ default: true })
  @Column({ default: true })
  ativo: boolean;
}

import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { AuditAction } from '../../../common/enums/auditoria.enum';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('auditoria')
export class Auditoria extends BaseEntity {
  /**
   * Nome amigável da entidade para uso em logs de auditoria
   */
  static get nomeAmigavel(): string {
    return 'auditoria';
  }

  @Column({ type: 'enum', enum: AuditAction })
  acao: AuditAction;

  @Column({ type: 'text', nullable: true })
  descricao: string | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'usuarioId' })
  usuario: Usuario;

  @Column({ type: 'varchar', nullable: true })
  entidade: string | null;

  @Column({ type: 'varchar', nullable: true })
  entidadeId: string | null;

  @Column({ type: 'jsonb', nullable: true })
  dadosAnteriores: any;

  @Column({ type: 'jsonb', nullable: true })
  dadosNovos: any;

  @Column({ type: 'varchar', nullable: true })
  enderecoIp: string | null;

  constructor() {
    super();
  }
}
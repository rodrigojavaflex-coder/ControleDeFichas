import {
  Entity,
  Column,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';

@Entity('configuracoes')
export class Configuracao extends BaseEntity {
  /**
   * Nome amigável da entidade para uso em logs de auditoria
   */
  static get nomeAmigavel(): string {
    return 'configuração';
  }

  @Column({ nullable: true })
  nomeCliente: string;

  @Column({ nullable: true })
  logoRelatorio: string; // Marcador '/configuracao/logo' quando há logo no BD; legado para compat

  /** Imagem do logo armazenada no BD (não retornada no findOne; usar GET /configuracao/logo) */
  @Column({ type: 'bytea', nullable: true, select: false })
  logoImagem: Buffer | null;

  @Column({ type: 'varchar', length: 100, nullable: true, select: false })
  logoImagemMime: string | null;

  @Column({ nullable: true })
  farmaceuticoResponsavel: string;

  // Configurações de Auditoria
  @Column({ default: true })
  auditarConsultas: boolean;

  @Column({ default: true })
  auditarLoginLogOff: boolean;

  @Column({ default: true })
  auditarCriacao: boolean;

  @Column({ default: true })
  auditarAlteracao: boolean;

  @Column({ default: true })
  auditarExclusao: boolean;

  @Column({ default: true })
  auditarSenhaAlterada: boolean;
}
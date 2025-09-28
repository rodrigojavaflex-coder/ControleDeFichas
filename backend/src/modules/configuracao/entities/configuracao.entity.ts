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
  logoRelatorio: string; // Caminho/URL da imagem

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
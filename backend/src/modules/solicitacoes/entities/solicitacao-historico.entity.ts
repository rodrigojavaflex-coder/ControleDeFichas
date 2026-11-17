import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';
import { StatusSolicitacao } from '../enums/status-solicitacao.enum';
import { Solicitacao } from './solicitacao.entity';

@Entity('solicitacao_historicos')
export class SolicitacaoHistorico extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'histórico da solicitação';
  }

  @ApiProperty()
  @Column({ type: 'uuid' })
  solicitacaoId: string;

  @ManyToOne(() => Solicitacao, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'solicitacaoId' })
  solicitacao?: Solicitacao;

  @ApiProperty({ enum: StatusSolicitacao })
  @Column({ type: 'varchar', length: 20 })
  status: StatusSolicitacao;

  @ApiProperty()
  @Column({ type: 'text' })
  descricao: string;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'uuid', nullable: true })
  usuarioId: string | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'usuarioId' })
  usuario?: Usuario | null;
}

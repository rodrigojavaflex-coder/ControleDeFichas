import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Funcionario } from '../../folha/entities/funcionario.entity';
import { VisitacaoFechamento } from './visitacao-fechamento.entity';

/** Snapshot do painel da unidade no momento do fechar (RN-VIS-013). */
@Entity('visitacao_fechamento_carteira')
@Index('idx_visitacao_fech_carteira_fechamento', ['fechamentoId'])
@Index('uq_visitacao_fech_carteira_crm_rep', [
  'fechamentoId',
  'crmMedico',
  'ufCrmMedico',
  'contratoRepresentante',
  'codigoRepresentante',
], { unique: true })
export class VisitacaoFechamentoCarteira extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'carteira do fechamento de visitação';
  }

  @Column({ type: 'uuid', name: 'fechamento_id' })
  fechamentoId: string;

  @ManyToOne(() => VisitacaoFechamento, (f) => f.carteira, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fechamento_id' })
  fechamento: VisitacaoFechamento;

  @ApiProperty({ required: false, type: () => Funcionario })
  @ManyToOne(() => Funcionario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'funcionario_id' })
  funcionario?: Funcionario | null;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20, name: 'crm_medico' })
  crmMedico: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 2, name: 'uf_crm_medico' })
  ufCrmMedico: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 500, name: 'nome_medico' })
  nomeMedico: string;

  @ApiProperty()
  @Column({ type: 'integer', name: 'contrato_representante' })
  contratoRepresentante: number;

  @ApiProperty()
  @Column({ type: 'integer', name: 'codigo_representante' })
  codigoRepresentante: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 500, name: 'nome_representante' })
  nomeRepresentante: string;
}

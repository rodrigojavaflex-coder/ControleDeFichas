import { Entity, Column, Index } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { MotivoRemocaoPainel } from '../../../common/enums/motivo-remocao-painel.enum';

@Entity('painel_medicos_representantes_historico')
@Index('idx_painel_hist_unidade_removido', ['unidade', 'removidoEm'])
export class PainelMedicoRepresentanteHistorico extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'histórico painel médico representante';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 20 })
  unidade: Unidade;

  @ApiProperty()
  @Column({ type: 'varchar', length: 500 })
  nomeMedico: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 2 })
  ufCrmMedico: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20 })
  crmMedico: string;

  @ApiProperty()
  @Column({ type: 'integer' })
  contratoRepresentante: number;

  @ApiProperty()
  @Column({ type: 'integer' })
  codigoRepresentante: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 500 })
  nomeRepresentante: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 100, nullable: true })
  configNoMomento?: string | null;

  @ApiProperty({ enum: MotivoRemocaoPainel })
  @Column({ type: 'varchar', length: 30 })
  motivoRemocao: MotivoRemocaoPainel;

  @ApiProperty()
  @Column({ type: 'timestamp' })
  removidoEm: Date;

  @ApiProperty({ required: false })
  @Column({ type: 'uuid', nullable: true })
  origemPainelId?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'timestamp', nullable: true })
  criadoEmPainel?: Date | null;
}

import { Entity, Column, Index, Unique } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('producao_painel_etapa_final')
@Unique('uq_producao_painel_etapa_final_unidade_cod', ['unidade', 'codEtapa'])
@Index('idx_producao_painel_etapa_final_unidade', ['unidade'])
export class ProducaoPainelEtapaFinal extends BaseEntity {
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @Column({ type: 'varchar', length: 20 })
  codEtapa: string;
}

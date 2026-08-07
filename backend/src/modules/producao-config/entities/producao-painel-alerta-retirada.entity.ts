import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

export enum ProducaoPainelAlertaTipo {
  ANTES = 'ANTES',
  ATRASADO = 'ATRASADO',
}

export enum ProducaoPainelAlertaCor {
  AMARELO = 'AMARELO',
  LARANJA = 'LARANJA',
  VERMELHO = 'VERMELHO',
  NEUTRO = 'NEUTRO',
}

@Entity('producao_painel_alerta_retirada')
@Index('idx_producao_painel_alerta_unidade_ordem', ['unidade', 'ordem'])
export class ProducaoPainelAlertaRetirada extends BaseEntity {
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @Column({ type: 'integer', default: 0 })
  ordem: number;

  @Column({ type: 'varchar', length: 16 })
  tipo: ProducaoPainelAlertaTipo;

  @Column({ type: 'integer', nullable: true })
  minutosAntes: number | null;

  @Column({ type: 'varchar', length: 16 })
  cor: string;

  @Column({ type: 'varchar', length: 120, nullable: true })
  rotulo: string | null;
}

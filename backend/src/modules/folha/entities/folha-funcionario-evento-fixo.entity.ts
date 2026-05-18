import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Funcionario } from './funcionario.entity';
import { FolhaVerba } from './folha-verba.entity';

/** Eventos padrão do funcionário, copiados para `folha_item` ao criar a capa pela primeira vez. */
@Entity('folha_funcionario_evento_fixo')
@Unique(['funcionario', 'folhaVerba'])
@Index('idx_folha_func_ev_fixo_func', ['funcionario'])
export class FolhaFuncionarioEventoFixo extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'evento fixo do funcionário';
  }

  @ApiProperty({ type: () => Funcionario })
  @ManyToOne(() => Funcionario, (f) => f.eventosFixos, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'funcionarioId' })
  funcionario: Funcionario;

  @ApiProperty({ type: () => FolhaVerba })
  @ManyToOne(() => FolhaVerba, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'folhaVerbaId' })
  folhaVerba: FolhaVerba;

  @ApiProperty({ example: '1500.00' })
  @Column({ type: 'decimal', precision: 12, scale: 2 })
  valor: string;

  @ApiProperty({ example: '1.0000' })
  @Column({ type: 'decimal', precision: 14, scale: 4, default: 1 })
  quantidade: string;
}

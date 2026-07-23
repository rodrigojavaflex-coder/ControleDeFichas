import { Entity, Column, Index, Unique, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Funcionario } from '../../folha/entities/funcionario.entity';

@Entity('producao_funcionario_etapa')
@Unique('uq_producao_func_etapa_func_cod', ['funcionario', 'codEtapa'])
@Index('idx_producao_func_etapa_unidade_func', ['unidade', 'funcionario'])
export class ProducaoFuncionarioEtapa extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'etapa de produção por funcionário';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty({ type: () => Funcionario })
  @ManyToOne(() => Funcionario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'funcionarioId' })
  funcionario: Funcionario;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20 })
  codEtapa: string;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  recebe: boolean;

  @ApiProperty({
    description:
      'Etapa ERP base para cálculo de Gestão (total no período × valor Gestão)',
    required: false,
  })
  @Column({
    name: 'cod_etapa_referencia',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  codEtapaReferencia: string | null;
}

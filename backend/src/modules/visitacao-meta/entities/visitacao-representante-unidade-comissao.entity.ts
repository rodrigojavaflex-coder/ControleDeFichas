import { Column, Entity, Index, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Funcionario } from '../../folha/entities/funcionario.entity';

@Entity('visitacao_representante_unidade_comissao')
@Unique('uq_visitacao_rep_unid_comissao', ['funcionario', 'unidade'])
@Index('idx_visitacao_rep_unid_comissao_func', ['funcionario'])
export class VisitacaoRepresentanteUnidadeComissao extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'unidade de comissão da visitação';
  }

  @ApiProperty({ type: () => Funcionario })
  @ManyToOne(() => Funcionario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'funcionarioId' })
  funcionario: Funcionario;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;
}

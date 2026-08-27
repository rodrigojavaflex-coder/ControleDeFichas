import { Column, Entity, JoinColumn, ManyToOne, Unique } from 'typeorm';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { ComercialTipoBase } from '../../../common/enums/comercial-tipo-base.enum';
import { ComercialIncidenciaComissao } from '../../../common/enums/comercial-incidencia-comissao.enum';
import { Funcionario } from '../../folha/entities/funcionario.entity';

const numericToNumberOrNull = {
  to: (value: number | null) => value,
  from: (value: string | null): number | null =>
    value == null || value === '' ? null : Number(value),
};

@Entity('comercial_comissao_politica')
@Unique('uq_comercial_comissao_politica_func_tipo', ['funcionario', 'tipoBase'])
export class ComercialComissaoPolitica extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'política de comissão comercial';
  }

  @ApiProperty({ type: () => Funcionario })
  @ManyToOne(() => Funcionario, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'funcionarioId' })
  funcionario: Funcionario;

  @ApiProperty({ enum: ComercialTipoBase })
  @Column({ type: 'varchar', length: 20 })
  tipoBase: ComercialTipoBase;

  @ApiProperty({ enum: ComercialIncidenciaComissao })
  @Column({
    type: 'varchar',
    length: 20,
    default: ComercialIncidenciaComissao.PROPRIAS,
  })
  incidencia: ComercialIncidenciaComissao;

  @ApiPropertyOptional({
    nullable: true,
    example: 100,
    description:
      '% mínimo da meta da loja para pagar. Nulo = paga sempre (sem trava).',
  })
  @Column({
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    transformer: numericToNumberOrNull,
  })
  percentualMinimoLoja: number | null;
}

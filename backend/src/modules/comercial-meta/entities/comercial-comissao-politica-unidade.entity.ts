import { Column, Entity, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

@Entity('comercial_comissao_politica_unidade')
@Unique('uq_comercial_comissao_politica_unidade', ['unidade'])
export class ComercialComissaoPoliticaUnidade extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'política de comissão da unidade';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty({
    type: [Number],
    example: [276, 330],
    description:
      'Códigos de setor ERP (FC03000.SETOR) da marca própria da loja. Vazio = não exibe o recorte no card TOTAL.',
  })
  @Column({
    type: 'int',
    array: true,
    default: '{}',
  })
  codigosSetor: number[];

  @ApiProperty({
    type: [Number],
    example: [400],
    description:
      'Setores de revenda que somam em Manipulados no card TOTAL. Vazio = só requisições.',
  })
  @Column({
    type: 'int',
    array: true,
    default: '{}',
  })
  codigosSetorRevendaManipulados: number[];
}

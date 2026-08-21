import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class VisitacaoAcompanhamentoItemDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  nomeMedico: string;

  @ApiProperty()
  crmMedico: string;

  @ApiProperty()
  ufCrmMedico: string;

  @ApiPropertyOptional({
    description: 'Nome do funcionário vinculado ou nome ERP do painel.',
  })
  nomeRepresentante?: string | null;

  @ApiProperty({
    description: 'Médico está no painel da carteira (filtro/unidade do usuário).',
  })
  naCarteira: boolean;

  @ApiPropertyOptional({
    enum: Unidade,
    nullable: true,
    description: 'Unidade do painel (indicação), quando houver.',
  })
  unidadeCarteira?: Unidade | null;

  @ApiProperty({
    description:
      'Movimento ocorreu em unidade diferente da carteira/painel do médico.',
  })
  movimentoForaCarteira: boolean;

  @ApiProperty({
    description: 'Soma de valor_liquido_linha das requisições no período.',
  })
  valorRecebido: number;

  @ApiProperty()
  quantidadeRecebido: number;

  @ApiProperty({
    description: 'Soma de precoVenda dos orçamentos REJEITADO no período.',
  })
  valorRejeitado: number;

  @ApiProperty()
  quantidadeRejeitado: number;
}

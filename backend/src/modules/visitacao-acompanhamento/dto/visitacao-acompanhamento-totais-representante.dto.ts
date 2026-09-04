import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';
import { VisitacaoAcompanhamentoTotaisDto } from './visitacao-acompanhamento-totais.dto';
import { VisitacaoAcompanhamentoRecebidoUnidadeDto } from './visitacao-acompanhamento-recebido-unidade.dto';

export class VisitacaoAcompanhamentoTotaisRepresentanteDto extends VisitacaoAcompanhamentoTotaisDto {
  @ApiProperty()
  nomeRepresentante: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Funcionário vinculado ao painel; nulo se sem cadastro.',
  })
  funcionarioId?: string | null;

  @ApiPropertyOptional({
    type: [VisitacaoAcompanhamentoRecebidoUnidadeDto],
    description:
      'Recebido da carteira nas unidades configuradas para comissão (RN-VIS-010 / RN-VIS-011).',
  })
  recebidoPorUnidade?: VisitacaoAcompanhamentoRecebidoUnidadeDto[];

  @ApiPropertyOptional({
    enum: Unidade,
    isArray: true,
    description: 'Unidades que entram no card, % meta, projeção e comissão.',
  })
  unidadesComissao?: Unidade[];
}

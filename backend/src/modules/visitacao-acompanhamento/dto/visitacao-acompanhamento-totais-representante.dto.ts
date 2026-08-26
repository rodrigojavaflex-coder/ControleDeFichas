import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VisitacaoAcompanhamentoTotaisDto } from './visitacao-acompanhamento-totais.dto';

export class VisitacaoAcompanhamentoTotaisRepresentanteDto extends VisitacaoAcompanhamentoTotaisDto {
  @ApiProperty()
  nomeRepresentante: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Funcionário vinculado ao painel; nulo se sem cadastro.',
  })
  funcionarioId?: string | null;
}

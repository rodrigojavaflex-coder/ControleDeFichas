import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class VisitacaoPainelMedicoItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  nomeMedico: string;

  @ApiProperty()
  ufCrmMedico: string;

  @ApiProperty()
  crmMedico: string;

  @ApiProperty()
  contratoRepresentante: number;

  @ApiProperty()
  codigoRepresentante: number;

  @ApiProperty()
  nomeRepresentanteErp: string;

  @ApiPropertyOptional({
    description: 'Funcionário PG vinculado ao par filial/código do painel.',
  })
  funcionarioId?: string | null;

  @ApiPropertyOptional({
    description: 'Nome do funcionário vinculado (coluna Representante na UI).',
  })
  nomeRepresentante?: string | null;

  @ApiProperty({
    description: 'Indica se existe funcionário com vínculo ao par do painel.',
  })
  vinculadoFuncionario: boolean;

  @ApiProperty()
  criadoEm: Date;

  @ApiProperty()
  atualizadoEm: Date;
}

import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class VisitacaoPainelMedicoRepresentanteDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nome: string;

  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  painelContratoRepresentante: number;

  @ApiProperty()
  painelCodigoRepresentante: number;
}

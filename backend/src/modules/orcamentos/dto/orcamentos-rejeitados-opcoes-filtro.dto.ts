import { ApiProperty } from '@nestjs/swagger';
import { OrcamentoMedicoOpcaoDto } from './orcamento-medico-opcao.dto';

export class OrcamentosRejeitadosOpcoesFiltroDto {
  @ApiProperty({ type: [OrcamentoMedicoOpcaoDto] })
  medicos: OrcamentoMedicoOpcaoDto[];
}

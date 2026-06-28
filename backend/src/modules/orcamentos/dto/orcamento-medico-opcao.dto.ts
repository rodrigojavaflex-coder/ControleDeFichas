import { ApiProperty } from '@nestjs/swagger';

export class OrcamentoMedicoOpcaoDto {
  @ApiProperty({ description: 'Rótulo no formato NOME - UNIDADE' })
  nome: string;

  @ApiProperty()
  total: number;

  @ApiProperty()
  aprovados: number;

  @ApiProperty()
  rejeitados: number;
}

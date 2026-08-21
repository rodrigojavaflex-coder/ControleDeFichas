import { ApiProperty } from '@nestjs/swagger';

export class VisitacaoAcompanhamentoTotaisDto {
  @ApiProperty()
  valorRecebido: number;

  @ApiProperty()
  quantidadeRecebido: number;

  @ApiProperty()
  valorRejeitado: number;

  @ApiProperty()
  quantidadeRejeitado: number;

  @ApiProperty({ description: 'Quantidade de médicos (linhas) no filtro.' })
  quantidadeMedicos: number;
}

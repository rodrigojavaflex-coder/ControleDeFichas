import { ApiProperty } from '@nestjs/swagger';

export class VisitacaoAcompanhamentoTotaisRepresentanteDto {
  @ApiProperty()
  nomeRepresentante: string;

  @ApiProperty()
  valorRecebido: number;

  @ApiProperty()
  quantidadeRecebido: number;

  @ApiProperty()
  valorRejeitado: number;

  @ApiProperty()
  quantidadeRejeitado: number;

  @ApiProperty({
    description: 'Quantidade de médicos (linhas unidade+CRM) do representante no filtro.',
  })
  quantidadeMedicos: number;
}

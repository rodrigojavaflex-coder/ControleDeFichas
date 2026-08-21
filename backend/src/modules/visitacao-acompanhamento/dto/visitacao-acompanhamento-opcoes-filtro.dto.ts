import { ApiProperty } from '@nestjs/swagger';

export class VisitacaoAcompanhamentoMedicoOpcaoDto {
  @ApiProperty({ description: 'Rótulo no formato NOME - UNIDADE' })
  nome: string;

  @ApiProperty({ description: 'Quantidade de movimentos (recebidos + rejeitados)' })
  total: number;

  @ApiProperty({ description: 'Quantidade de requisições recebidas no caixa' })
  aprovados: number;

  @ApiProperty({ description: 'Quantidade de orçamentos rejeitados' })
  rejeitados: number;
}

export class VisitacaoAcompanhamentoOpcoesFiltroDto {
  @ApiProperty({ type: [VisitacaoAcompanhamentoMedicoOpcaoDto] })
  medicos: VisitacaoAcompanhamentoMedicoOpcaoDto[];
}

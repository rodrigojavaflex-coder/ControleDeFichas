import { ApiProperty } from '@nestjs/swagger';

export class ProducaoFuncionarioGestaoBaseOpcaoDto {
  @ApiProperty()
  codEtapa: string;

  @ApiProperty()
  etapa: string;
}

export class ProducaoFuncionarioGestaoConfigDto {
  @ApiProperty()
  disponivel: boolean;

  @ApiProperty()
  recebe: boolean;

  @ApiProperty({ nullable: true })
  codEtapaReferencia: string | null;

  @ApiProperty({ nullable: true })
  etapaReferencia: string | null;

  @ApiProperty()
  valor: number;

  @ApiProperty({ type: [ProducaoFuncionarioGestaoBaseOpcaoDto] })
  opcoesBase: ProducaoFuncionarioGestaoBaseOpcaoDto[];
}

export class ProducaoFuncionarioEtapasResponseDto {
  @ApiProperty({ type: [Object] })
  etapas: {
    codEtapa: string;
    etapa: string;
    posicaoEtapa: number;
    etapaRemunerada: boolean;
    valor: number;
    recebe: boolean;
  }[];

  @ApiProperty({ type: ProducaoFuncionarioGestaoConfigDto, nullable: true })
  gestao: ProducaoFuncionarioGestaoConfigDto | null;
}

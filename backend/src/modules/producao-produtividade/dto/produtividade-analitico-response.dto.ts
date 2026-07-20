import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class ProdutividadeAnaliticoLinhaDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  funcionario: string;

  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  codEtapa: string;

  @ApiProperty()
  etapa: string;

  @ApiProperty()
  requisicao: number;

  @ApiProperty()
  formula: string;

  @ApiProperty({ description: 'Data de saída da etapa (YYYY-MM-DD)' })
  data: string;
}

export class ProdutividadeAnaliticoResponseDto {
  @ApiProperty({ enum: Unidade, isArray: true })
  unidades: Unidade[];

  @ApiProperty()
  dataInicio: string;

  @ApiProperty()
  dataFim: string;

  @ApiProperty({ type: [ProdutividadeAnaliticoLinhaDto] })
  linhas: ProdutividadeAnaliticoLinhaDto[];
}

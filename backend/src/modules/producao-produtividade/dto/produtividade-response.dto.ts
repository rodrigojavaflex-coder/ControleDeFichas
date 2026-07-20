import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class ProdutividadeEtapaRowDto {
  @ApiProperty()
  codEtapa: string;

  @ApiProperty()
  etapa: string;

  @ApiProperty()
  quantidade: number;

  @ApiProperty()
  valorUnitario: number;

  @ApiProperty()
  valorTotal: number;
}

export class ProdutividadeFuncionarioRowDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty({ enum: Unidade, isArray: true })
  unidades: Unidade[];

  @ApiProperty()
  nome: string;

  @ApiProperty()
  codigoFuncionarioErp: number;

  @ApiProperty({ type: [Number], required: false })
  codigosFuncionarioErp?: number[];

  @ApiProperty({ nullable: true })
  setor: string | null;

  @ApiProperty({ nullable: true })
  cargo: string | null;

  @ApiProperty()
  totalQuantidade: number;

  @ApiProperty()
  totalValor: number;

  @ApiProperty({ type: [ProdutividadeEtapaRowDto] })
  etapas: ProdutividadeEtapaRowDto[];
}

export class ProdutividadeResumoDto {
  @ApiProperty()
  linhasResumo: number;

  @ApiProperty()
  linhasContabilizadas: number;

  @ApiProperty()
  linhasSemFuncionario: number;

  /** Linhas ignoradas (etapa não remunerada ou não vinculada ao funcionário). Uso interno/diagnóstico. */
  @ApiProperty()
  linhasEtapaNaoConfigurada: number;

  @ApiProperty()
  totalQuantidade: number;

  @ApiProperty()
  totalValor: number;

  @ApiProperty()
  totalFuncionarios: number;
}

export class ProdutividadeSemCadastroUnidadeDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  linhas: number;
}

export class ProdutividadeFuncionarioSemCadastroDto {
  @ApiProperty()
  codigoErp: number;

  @ApiProperty()
  nome: string;

  @ApiProperty({ type: [ProdutividadeSemCadastroUnidadeDto] })
  unidades: ProdutividadeSemCadastroUnidadeDto[];

  @ApiProperty()
  totalLinhas: number;
}

export class ProdutividadeEtapaNaoVinculadaDto {
  @ApiProperty()
  codEtapa: string;

  @ApiProperty()
  etapa: string;

  @ApiProperty()
  linhas: number;
}

export class ProdutividadeFuncionarioSemEtapaVinculadaDto {
  @ApiProperty()
  codigoErp: number;

  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  nome: string;

  @ApiProperty({ type: [ProdutividadeSemCadastroUnidadeDto] })
  unidades: ProdutividadeSemCadastroUnidadeDto[];

  @ApiProperty({ type: [ProdutividadeEtapaNaoVinculadaDto] })
  etapas: ProdutividadeEtapaNaoVinculadaDto[];

  @ApiProperty()
  totalLinhas: number;
}

export class ProdutividadeAvisosDto {
  @ApiProperty()
  totalLinhasSemCadastro: number;

  @ApiProperty({ type: [ProdutividadeFuncionarioSemCadastroDto] })
  funcionariosSemCadastro: ProdutividadeFuncionarioSemCadastroDto[];

  @ApiProperty({
    description: 'Quantidade de funcionários omitidos da lista por limite de exibição',
  })
  funcionariosSemCadastroOcultos: number;

  @ApiProperty()
  totalLinhasSemEtapaVinculada: number;

  @ApiProperty({ type: [ProdutividadeFuncionarioSemEtapaVinculadaDto] })
  funcionariosSemEtapaVinculada: ProdutividadeFuncionarioSemEtapaVinculadaDto[];

  @ApiProperty({
    description:
      'Quantidade de funcionários com cadastro omitidos da lista por limite de exibição',
  })
  funcionariosSemEtapaVinculadaOcultos: number;
}

export class ProdutividadeConsultaResponseDto {
  @ApiProperty({ enum: Unidade, isArray: true })
  unidades: Unidade[];

  @ApiProperty()
  dataInicio: string;

  @ApiProperty()
  dataFim: string;

  @ApiProperty({ type: ProdutividadeResumoDto })
  resumo: ProdutividadeResumoDto;

  @ApiProperty({ type: ProdutividadeAvisosDto })
  avisos: ProdutividadeAvisosDto;

  @ApiProperty({ type: [ProdutividadeFuncionarioRowDto] })
  funcionarios: ProdutividadeFuncionarioRowDto[];
}

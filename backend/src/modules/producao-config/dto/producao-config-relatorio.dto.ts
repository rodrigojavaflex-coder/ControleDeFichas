import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class ProducaoConfigRelatorioEtapaDto {
  @ApiProperty()
  codEtapa: string;

  @ApiProperty()
  etapa: string;

  @ApiProperty()
  posicaoEtapa: number;

  @ApiProperty()
  valor: number;
}

export class ProducaoConfigRelatorioFuncionarioEtapaDto {
  @ApiProperty()
  codEtapa: string;

  @ApiProperty()
  etapa: string;
}

export class ProducaoConfigRelatorioFuncionarioDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  nome: string;

  @ApiProperty({ nullable: true })
  setor: string | null;

  @ApiProperty({ nullable: true })
  cargo: string | null;

  @ApiProperty()
  codigoFuncionarioErp: number;

  @ApiProperty()
  desligado: boolean;

  @ApiProperty({ nullable: true })
  dataDemissao: string | null;

  @ApiProperty({ type: [ProducaoConfigRelatorioFuncionarioEtapaDto] })
  etapas: ProducaoConfigRelatorioFuncionarioEtapaDto[];
}

export class ProducaoConfigRelatorioResponseDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty({ type: [ProducaoConfigRelatorioEtapaDto] })
  etapasRemuneradas: ProducaoConfigRelatorioEtapaDto[];

  @ApiProperty({ type: [ProducaoConfigRelatorioFuncionarioDto] })
  funcionarios: ProducaoConfigRelatorioFuncionarioDto[];
}

export class AplicarEtapasRemuneradasResponseDto {
  @ApiProperty()
  funcionariosAtualizados: number;

  @ApiProperty()
  etapasAplicadas: number;
}

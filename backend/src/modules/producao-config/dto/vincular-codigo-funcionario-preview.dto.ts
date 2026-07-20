import { ApiProperty } from '@nestjs/swagger';

export enum VinculoCodigoFuncionarioSituacao {
  PREENCHER = 'PREENCHER',
  OK_JA_CORRETO = 'OK_JA_CORRETO',
  CONFLITO_CODIGO_DIFERENTE = 'CONFLITO_CODIGO_DIFERENTE',
  MULTIPLOS_FUNCIONARIOS_MESMO_NOME = 'MULTIPLOS_FUNCIONARIOS_MESMO_NOME',
  MULTIPLOS_COD_ERP_MESMO_FUNCIONARIO = 'MULTIPLOS_COD_ERP_MESMO_FUNCIONARIO',
  MULTIPLOS_NOMES_MESMO_COD_ERP = 'MULTIPLOS_NOMES_MESMO_COD_ERP',
}

export class VinculoCodigoFuncionarioPreviewRowDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  funcionarioNome: string;

  @ApiProperty()
  funcSaidaErp: string;

  @ApiProperty()
  codigoErp: number;

  @ApiProperty({ required: false, nullable: true })
  codigoAtual: number | null;

  @ApiProperty({ enum: VinculoCodigoFuncionarioSituacao })
  situacao: VinculoCodigoFuncionarioSituacao;

  @ApiProperty()
  atualizavel: boolean;
}

export class VinculoCodigoFuncionarioPreviewResumoDto {
  @ApiProperty()
  totalErp: number;

  @ApiProperty()
  totalPreencher: number;

  @ApiProperty()
  totalOk: number;

  @ApiProperty()
  totalConflitos: number;

  @ApiProperty()
  totalAmbiguos: number;

  @ApiProperty()
  totalErpSemFuncionario: number;
}

export class VinculoCodigoFuncionarioPreviewResponseDto {
  @ApiProperty({ type: [VinculoCodigoFuncionarioPreviewRowDto] })
  itens: VinculoCodigoFuncionarioPreviewRowDto[];

  @ApiProperty({ type: VinculoCodigoFuncionarioPreviewResumoDto })
  resumo: VinculoCodigoFuncionarioPreviewResumoDto;

  @ApiProperty({ type: [String] })
  erpSemFuncionario: string[];
}

export class VinculoCodigoFuncionarioConfirmResponseDto {
  @ApiProperty()
  atualizados: number;

  @ApiProperty({ type: [VinculoCodigoFuncionarioPreviewRowDto] })
  itens: VinculoCodigoFuncionarioPreviewRowDto[];
}

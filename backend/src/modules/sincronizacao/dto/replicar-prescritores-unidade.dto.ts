import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class ReplicarPrescritoresUnidadeDto {
  @ApiProperty({
    default: false,
    description: 'false = prévia; true = grava cópias, vendas e nomes congelados',
  })
  @IsBoolean()
  aplicar!: boolean;
}

export class ReplicarPrescritorAmostraDto {
  @ApiProperty()
  crm!: string;

  @ApiProperty()
  uf!: string;

  @ApiProperty()
  pfcrm!: string;

  @ApiProperty({ type: 'array', items: { type: 'object' } })
  porUnidade!: Array<{ unidade: string; nome: string; origem: 'erp' | 'nest' }>;
}

export class ReplicarPrescritoresUnidadeResponseDto {
  @ApiProperty()
  aplicar!: boolean;

  @ApiProperty()
  triadesComUso!: number;

  @ApiProperty()
  copiasCriadas!: number;

  @ApiProperty()
  atribuicoes!: number;

  @ApiProperty()
  nomesCadastroAtualizados!: number;

  @ApiProperty()
  semCadastroErp!: number;

  @ApiProperty({
    description:
      'CRM+UF+unidade com profissão vazia que herdaram a única profissão do FC04000 da loja',
  })
  profissoesHerdadas!: number;

  @ApiProperty({
    description:
      'CRM+UF+unidade com profissão vazia e mais de uma profissão no FC04000; não escolhe',
  })
  profissoesAmbiguas!: number;

  @ApiProperty({
    description: 'Usos sem nome no ERP e sem nome no NEST; a linha não é criada',
  })
  semNomeIgnorados!: number;

  @ApiProperty({
    description:
      'Prescritores sem CRM ou sem UF que recebem a unidade da venda de terceiro',
  })
  prescritoresVendaTerceiro!: number;

  @ApiProperty({
    description:
      'Cópias quando o mesmo prescritor sem CRM/UF tem venda em mais de uma loja',
  })
  copiasVendaTerceiro!: number;

  @ApiProperty()
  prescritoresSemUnidade!: number;

  @ApiProperty()
  vendasRepontadas!: number;

  @ApiProperty()
  vendasSemUnidade!: number;

  @ApiProperty()
  retratoMedico!: number;

  @ApiProperty()
  retratoCarteira!: number;

  @ApiProperty()
  historicoPainel!: number;

  @ApiProperty()
  producao!: number;

  @ApiProperty({ type: [String] })
  agentesConsultados!: string[];

  @ApiProperty({ type: [String] })
  erros!: string[];

  @ApiProperty({ type: [ReplicarPrescritorAmostraDto] })
  amostra!: ReplicarPrescritorAmostraDto[];
}

export class ReplicarPrescritoresUnidadeStatusDto {
  @ApiProperty()
  emAndamento!: boolean;

  @ApiProperty({
    description:
      'agentes, uso, plano, prescritores, terceiro, pfcrm, vendas, retrato, carteira, historico, producao, commit, concluido, erro ou ocioso',
  })
  etapa!: string;

  @ApiProperty()
  mensagem!: string;

  @ApiProperty({ nullable: true })
  iniciadoEm!: string | null;

  @ApiProperty({ nullable: true })
  atualizadoEm!: string | null;

  @ApiProperty({ nullable: true })
  erro!: string | null;
}

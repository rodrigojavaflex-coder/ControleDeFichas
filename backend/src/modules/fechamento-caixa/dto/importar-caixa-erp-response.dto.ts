import { ApiProperty } from '@nestjs/swagger';
import { CaixaTerceiroOrigemTotalDto } from './caixa-terceiro-origem-total.dto';

export class CaixaFormaTotalDto {
  @ApiProperty()
  qtd: number;

  @ApiProperty()
  liquido: number;
}

export class ImportarCaixaErpResponseDto {
  @ApiProperty({ example: '2025-10-01' })
  dataInicio: string;

  @ApiProperty({ example: '2025-10-31' })
  dataFim: string;

  @ApiProperty()
  unidade: string;

  @ApiProperty()
  cdfil: number;

  @ApiProperty()
  pagamentosImportados: number;

  @ApiProperty()
  pagamentosAtualizados: number;

  @ApiProperty()
  itensImportados: number;

  @ApiProperty()
  itensAtualizados: number;

  @ApiProperty()
  requisicoesImportadas: number;

  @ApiProperty()
  requisicoesAtualizadas: number;

  @ApiProperty({
    description: 'Totais ERP por forma de pagamento',
    type: 'object',
    additionalProperties: { type: 'object' },
  })
  totaisPorForma: Record<string, CaixaFormaTotalDto>;

  @ApiProperty({
    description: 'Totais ERP por forma normalizada',
    type: 'object',
    additionalProperties: { type: 'object' },
  })
  totaisErpNormalizados: Record<string, CaixaFormaTotalDto>;

  @ApiProperty({
    description: 'Totais de baixas de terceiro agregados por forma',
    type: 'object',
    additionalProperties: { type: 'object' },
  })
  totaisTerceiro: Record<string, CaixaFormaTotalDto>;

  @ApiProperty({
    description: 'Totais de baixas de terceiro por forma e origem (comprado em)',
    type: [CaixaTerceiroOrigemTotalDto],
  })
  totaisTerceiroDetalhe: CaixaTerceiroOrigemTotalDto[];

  @ApiProperty({
    description: 'Soma terceiro + ERP por forma normalizada',
    type: 'object',
    additionalProperties: { type: 'object' },
  })
  totaisConsolidados: Record<string, CaixaFormaTotalDto>;

  @ApiProperty()
  totalLiquido: number;

  @ApiProperty()
  totalLiquidoTerceiro: number;

  @ApiProperty()
  totalConsolidado: number;
}

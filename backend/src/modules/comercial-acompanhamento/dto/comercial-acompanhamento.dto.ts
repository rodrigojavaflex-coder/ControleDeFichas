import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class FindComercialAcompanhamentoDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ example: 2026 })
  @Type(() => Number)
  @IsInt()
  @Min(2026)
  @Max(2033)
  ano: number;

  @ApiProperty({ example: 8 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  funcionarioId?: string;
}

export class ComercialDesempenhoBaseDto {
  @ApiPropertyOptional({ nullable: true })
  valorMeta?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualMeta?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorProjetado?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualProjecao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualComissaoFaixa?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorComissao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualComissaoFaixaProjetada?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorComissaoProjetado?: number | null;

  @ApiPropertyOptional({ nullable: true })
  diasUteisMes?: number | null;

  @ApiPropertyOptional({ nullable: true })
  diasRealizados?: number | null;

  @ApiPropertyOptional()
  mesAberto?: boolean;
}

export class ComercialAcompanhamentoItemDto extends ComercialDesempenhoBaseDto {
  @ApiPropertyOptional({ nullable: true })
  funcionarioId: string | null;

  @ApiProperty()
  nomeVendedor: string;

  @ApiPropertyOptional({ nullable: true })
  codigoVendedorErp: number | null;

  @ApiProperty()
  valorRecebidoRequisicao: number;

  @ApiProperty()
  quantidadeRecebidoRequisicao: number;

  @ApiProperty()
  valorRecebidoMarcaPropria: number;

  @ApiProperty()
  quantidadeRecebidoMarcaPropria: number;

  @ApiProperty()
  valorRejeitado: number;

  @ApiProperty()
  quantidadeRejeitado: number;

  @ApiPropertyOptional({ nullable: true })
  valorMetaRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualMetaRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorProjetadoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualProjecaoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualComissaoFaixaRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorComissaoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorBonusRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorComissaoProjetadoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorBonusProjetadoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorMetaMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualMetaMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorProjetadoMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualProjecaoMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualComissaoFaixaMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorComissaoMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorBonusMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorComissaoProjetadoMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorBonusProjetadoMarcaPropria?: number | null;
}

export class ComercialAcompanhamentoTotaisDto extends ComercialDesempenhoBaseDto {
  @ApiProperty()
  valorRecebidoRequisicao: number;

  @ApiProperty()
  quantidadeRecebidoRequisicao: number;

  @ApiProperty()
  valorRecebidoMarcaPropria: number;

  @ApiProperty()
  quantidadeRecebidoMarcaPropria: number;

  @ApiProperty()
  valorRejeitado: number;

  @ApiProperty()
  quantidadeRejeitado: number;

  @ApiProperty()
  quantidadeVendedores: number;

  @ApiPropertyOptional({ nullable: true })
  valorMetaRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualMetaRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorMetaMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualMetaMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorProjetadoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualProjecaoRequisicao?: number | null;

  @ApiPropertyOptional({ nullable: true })
  valorProjetadoMarcaPropria?: number | null;

  @ApiPropertyOptional({ nullable: true })
  percentualProjecaoMarcaPropria?: number | null;
}

export class ComercialAcompanhamentoListResponseDto {
  @ApiProperty({ type: [ComercialAcompanhamentoItemDto] })
  itens: ComercialAcompanhamentoItemDto[];

  @ApiProperty({ type: ComercialAcompanhamentoTotaisDto })
  totais: ComercialAcompanhamentoTotaisDto;

  @ApiProperty()
  anoMes: string;

  @ApiProperty()
  dataInicial: string;

  @ApiProperty()
  dataFinal: string;
}

export class ComercialAcompanhamentoVendedorOpcaoDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  nome: string;

  @ApiProperty()
  codigoVendedorErp: number;
}

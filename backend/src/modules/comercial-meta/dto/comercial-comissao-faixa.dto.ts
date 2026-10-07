import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';
import { ComercialTipoBase } from '../../../common/enums/comercial-tipo-base.enum';
import { ComercialIncidenciaComissao } from '../../../common/enums/comercial-incidencia-comissao.enum';

export class FindComercialComissaoVendedoresDto {
  @ApiPropertyOptional({ enum: Unidade })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;
}

export class FindComercialComissaoFaixaDto {
  @ApiProperty()
  @IsUUID()
  funcionarioId: string;

  @ApiProperty({ enum: ComercialTipoBase })
  @IsEnum(ComercialTipoBase)
  tipoBase: ComercialTipoBase;
}

export class SalvarComercialComissaoFaixaDto {
  @ApiProperty()
  @IsUUID()
  funcionarioId: string;

  @ApiProperty({ enum: ComercialTipoBase })
  @IsEnum(ComercialTipoBase)
  tipoBase: ComercialTipoBase;

  @ApiProperty({ example: 80 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  percentualMetaDe: number;

  @ApiPropertyOptional({ nullable: true, example: 89.99 })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  percentualMetaAte?: number | null;

  @ApiProperty({ example: 1.5 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  percentualComissao: number;

  @ApiPropertyOptional({
    example: 150,
    description: 'Bônus em R$ ao atingir a faixa. Omitido = 0.',
    default: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  valorBonus?: number;
}

export class ComercialComissaoFaixaItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  funcionarioId: string;

  @ApiProperty({ enum: ComercialTipoBase })
  tipoBase: ComercialTipoBase;

  @ApiProperty()
  percentualMetaDe: number;

  @ApiPropertyOptional({ nullable: true })
  percentualMetaAte: number | null;

  @ApiProperty()
  percentualComissao: number;

  @ApiProperty({ example: 0 })
  valorBonus: number;

  @ApiProperty()
  ordem: number;
}

export class ComercialComissaoVendedorItemDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  nome: string;

  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  codigoVendedorErp: number;

  @ApiProperty()
  faixasRequisicaoCount: number;

  @ApiProperty()
  faixasMarcaPropriaCount: number;
}

export class ComercialComissaoVendedoresResponseDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty({ type: [ComercialComissaoVendedorItemDto] })
  itens: ComercialComissaoVendedorItemDto[];
}

export class CarregarComercialComissaoPadraoPendentesDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;
}

export class CarregarComercialComissaoPadraoPendentesResponseDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty({ description: 'Vendedores que receberam ao menos uma base' })
  vendedoresAfetados: number;

  @ApiProperty({ description: 'Quantidade de bases (manipulados/marca própria) preenchidas' })
  basesCarregadas: number;
}

export class FindComercialComissaoPoliticaDto {
  @ApiProperty()
  @IsUUID()
  funcionarioId: string;
}

export class ComercialComissaoPoliticaItemDto {
  @ApiProperty({ enum: ComercialTipoBase })
  tipoBase: ComercialTipoBase;

  @ApiProperty({ enum: ComercialIncidenciaComissao })
  incidencia: ComercialIncidenciaComissao;

  @ApiPropertyOptional({
    nullable: true,
    description: '% mínimo da meta da loja. Nulo = paga sempre.',
  })
  percentualMinimoLoja: number | null;

  @ApiPropertyOptional({
    type: [Number],
    description:
      'Códigos de setor ERP da marca própria. Vazio = todos os produtos.',
  })
  codigosSetor: number[];

  @ApiPropertyOptional({
    type: [Number],
    description:
      'Setores de revenda que somam em Manipulados. Vazio = só requisições.',
  })
  codigosSetorRevendaManipulados: number[];
}

export class ComercialComissaoPoliticaResponseDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty({ type: [ComercialComissaoPoliticaItemDto] })
  itens: ComercialComissaoPoliticaItemDto[];
}

export class SalvarComercialComissaoPoliticaDto {
  @ApiProperty()
  @IsUUID()
  funcionarioId: string;

  @ApiProperty({ enum: ComercialTipoBase })
  @IsEnum(ComercialTipoBase)
  tipoBase: ComercialTipoBase;

  @ApiProperty({ enum: ComercialIncidenciaComissao })
  @IsEnum(ComercialIncidenciaComissao)
  incidencia: ComercialIncidenciaComissao;

  @ApiPropertyOptional({
    nullable: true,
    example: 100,
    description: '% mínimo da meta da loja. Nulo ou omitido = paga sempre.',
  })
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(999.99)
  percentualMinimoLoja?: number | null;

  @ApiPropertyOptional({
    type: [Number],
    nullable: true,
    example: [276, 330],
    description:
      'Códigos de setor ERP (marca própria). Vazio/omitido = todos os produtos de revenda. Ignorado em Manipulados.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  codigosSetor?: number[] | null;

  @ApiPropertyOptional({
    type: [Number],
    nullable: true,
    example: [400],
    description:
      'Setores de revenda que somam em Manipulados. Vazio/omitido = só requisições. Ignorado em Marca própria.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  codigosSetorRevendaManipulados?: number[] | null;
}

export class FindComercialComissaoPoliticaUnidadeDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;
}

export class ComercialComissaoPoliticaUnidadeResponseDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty({
    type: [Number],
    description:
      'Códigos de setor ERP da marca própria da loja. Vazio = todos os produtos no card TOTAL.',
  })
  codigosSetor: number[];

  @ApiProperty({
    type: [Number],
    description:
      'Setores de revenda que somam em Manipulados no TOTAL. Vazio = só requisições.',
  })
  codigosSetorRevendaManipulados: number[];
}

export class SalvarComercialComissaoPoliticaUnidadeDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiPropertyOptional({
    type: [Number],
    nullable: true,
    example: [276, 330],
    description:
      'Códigos de setor ERP da marca própria da loja. Vazio/omitido = não recorta o card TOTAL.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  codigosSetor?: number[] | null;

  @ApiPropertyOptional({
    type: [Number],
    nullable: true,
    example: [400],
    description:
      'Setores de revenda que somam em Manipulados no TOTAL. Vazio/omitido = só requisições.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(1, { each: true })
  codigosSetorRevendaManipulados?: number[] | null;
}

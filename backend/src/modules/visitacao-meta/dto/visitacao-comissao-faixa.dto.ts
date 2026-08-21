import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  ValidateIf,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class FindVisitacaoComissaoRepresentantesDto {
  @ApiPropertyOptional({ enum: Unidade })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;
}

export class FindVisitacaoComissaoFaixaDto {
  @ApiProperty()
  @IsUUID()
  funcionarioId: string;
}

export class SalvarVisitacaoComissaoFaixaDto {
  @ApiProperty()
  @IsUUID()
  funcionarioId: string;

  @ApiProperty({ example: 80 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  percentualMetaDe: number;

  @ApiPropertyOptional({
    nullable: true,
    example: 89.99,
    description: 'Nulo ou omitido = sem teto',
  })
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
}

export class VisitacaoComissaoFaixaItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  percentualMetaDe: number;

  @ApiPropertyOptional({ nullable: true })
  percentualMetaAte: number | null;

  @ApiProperty()
  percentualComissao: number;

  @ApiProperty()
  ordem: number;
}

export class VisitacaoComissaoRepresentanteItemDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty()
  nome: string;

  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty({ description: 'Filial do painel (cdcon)' })
  painelContratoRepresentante: number;

  @ApiProperty({ description: 'Código representante painel (cdfun)' })
  painelCodigoRepresentante: number;

  @ApiProperty()
  faixasCount: number;
}

export class VisitacaoComissaoRepresentantesResponseDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty({ type: [VisitacaoComissaoRepresentanteItemDto] })
  itens: VisitacaoComissaoRepresentanteItemDto[];
}

import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';
import { ProducaoEtapaTipoCalculo } from '../../../common/constants/producao-gestao.constants';

export class ProducaoEtapaRemuneracaoItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  codEtapa: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 200)
  etapa: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  posicaoEtapa: number;

  @ApiProperty()
  @IsBoolean()
  recebe: boolean;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  valor: number;

  @ApiPropertyOptional({ enum: ProducaoEtapaTipoCalculo })
  @IsOptional()
  @IsEnum(ProducaoEtapaTipoCalculo)
  tipoCalculo?: ProducaoEtapaTipoCalculo;
}

export class BulkSaveProducaoEtapasDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ type: [ProducaoEtapaRemuneracaoItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProducaoEtapaRemuneracaoItemDto)
  itens: ProducaoEtapaRemuneracaoItemDto[];
}

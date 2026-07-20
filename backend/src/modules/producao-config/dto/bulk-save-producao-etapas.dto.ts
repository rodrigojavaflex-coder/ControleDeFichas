import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsString,
  Length,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

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

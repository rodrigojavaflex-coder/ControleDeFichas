import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class ProducaoFuncionarioEtapaItemDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Length(1, 20)
  codEtapa: string;

  @ApiProperty()
  @IsBoolean()
  recebe: boolean;
}

export class ProducaoFuncionarioGestaoSaveDto {
  @ApiProperty()
  @IsBoolean()
  recebe: boolean;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 20)
  codEtapaReferencia?: string | null;
}

export class BulkSaveProducaoFuncionarioEtapasDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ type: [ProducaoFuncionarioEtapaItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProducaoFuncionarioEtapaItemDto)
  itens: ProducaoFuncionarioEtapaItemDto[];

  @ApiPropertyOptional({ type: ProducaoFuncionarioGestaoSaveDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProducaoFuncionarioGestaoSaveDto)
  gestao?: ProducaoFuncionarioGestaoSaveDto;
}

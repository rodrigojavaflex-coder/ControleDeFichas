import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
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

export class BulkSaveProducaoFuncionarioEtapasDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiProperty({ type: [ProducaoFuncionarioEtapaItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProducaoFuncionarioEtapaItemDto)
  itens: ProducaoFuncionarioEtapaItemDto[];
}

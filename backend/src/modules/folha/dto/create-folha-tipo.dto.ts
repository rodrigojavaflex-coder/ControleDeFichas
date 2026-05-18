import { IsBoolean, IsOptional, IsString, Length, IsNumber, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateFolhaTipoDto {
  @IsString()
  @Length(1, 120)
  descricao: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  ordenacao?: number;

  @ApiPropertyOptional({ default: false, description: 'Folha de competência mensal (massa na tela de lançamentos)' })
  @IsOptional()
  @IsBoolean()
  folhaMensal?: boolean;
}

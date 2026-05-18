import {
  IsEnum,
  IsInt,
  Max,
  Min,
  IsOptional,
  IsBoolean,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class FindFuncionariosLancamentoFolhaDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  /** Se informado com mes, filtra funcionários não elegíveis a nova capa após demissão. */
  @ApiPropertyOptional({ minimum: 2000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  ano?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mes?: number;

  /** Apenas funcionários ativos no cadastro (padrão true). */
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Boolean)
  somenteAtivos?: boolean = true;

  /**
   * **Legado:** ignorado quando `ano`/`mes` estão informados — a lista já aplica apenas quem pode
   * nova capa na competência (RN-011), igual ao uso em `carregar-competencia`.
   */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null || value === '') return undefined;
    return value === true || value === 'true' || value === '1';
  })
  @IsBoolean()
  filtroCompetenciaMensal?: boolean;
}

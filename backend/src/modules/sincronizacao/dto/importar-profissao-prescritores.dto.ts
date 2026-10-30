import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class ImportProfissaoSelecaoDto {
  @ApiProperty()
  @IsString()
  acao!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  id?: string;

  @ApiProperty()
  @IsString()
  crm!: string;

  @ApiProperty()
  @IsString()
  uf!: string;

  @ApiProperty()
  @IsString()
  pfcrm!: string;
}

export class ImportarProfissaoPrescritoresDto {
  @ApiProperty({ default: false })
  @IsBoolean()
  aplicar!: boolean;

  @ApiPropertyOptional({ enum: Unidade })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;

  @ApiPropertyOptional({ type: [ImportProfissaoSelecaoDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ImportProfissaoSelecaoDto)
  itensSelecionados?: ImportProfissaoSelecaoDto[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  aplicarTodos?: boolean;
}

export class ImportProfissaoItemDto {
  @ApiPropertyOptional({ nullable: true })
  id!: string | null;

  @ApiProperty()
  crm!: string;

  @ApiProperty()
  uf!: string;

  @ApiProperty()
  pfcrm!: string;

  @ApiProperty()
  profissao!: string;

  @ApiProperty()
  nomeNest!: string | null;

  @ApiProperty()
  nomeErp!: string;

  @ApiPropertyOptional()
  pfcrmAtual?: string | null;

  @ApiPropertyOptional()
  origemErp?: string;

  @ApiProperty()
  motivo!: string;

  @ApiProperty()
  acao!: 'atualizar' | 'criar' | 'pendente' | 'igual';
}

export class ImportarProfissaoPrescritoresResponseDto {
  @ApiProperty()
  aplicar!: boolean;

  @ApiPropertyOptional({ nullable: true })
  unidadeFiltro!: Unidade | null;

  @ApiProperty()
  totalAnalisado!: number;

  @ApiProperty()
  aAplicar!: number;

  @ApiProperty()
  aplicados!: number;

  @ApiProperty()
  pendentes!: number;

  @ApiProperty()
  iguais!: number;

  @ApiProperty({ type: [String] })
  agentesConsultados!: string[];

  @ApiProperty({ type: [String] })
  erros!: string[];

  @ApiProperty({ type: [ImportProfissaoItemDto] })
  paraAplicar!: ImportProfissaoItemDto[];

  @ApiProperty({ type: [ImportProfissaoItemDto] })
  pendentesRelatorio!: ImportProfissaoItemDto[];
}

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

export class ReparoNomeMedicoSelecaoDto {
  @ApiProperty()
  @IsString()
  tabela!: string;

  @ApiProperty()
  @IsUUID()
  id!: string;
}

export class RepararNomesMedicosDto {
  @ApiProperty({
    description:
      'false = dry-run (só relatório); true = aplica UPDATE nos nomes selecionados (ou todos a corrigir se itensSelecionados omitido e aplicarTodos=true)',
    default: false,
  })
  @IsBoolean()
  aplicar!: boolean;

  @ApiPropertyOptional({
    enum: Unidade,
    description:
      'Filtra Nest por unidade e consulta só o agente correspondente. Sem valor = todas as unidades/agentes ativos.',
  })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;

  @ApiPropertyOptional({
    description:
      'Itens marcados para correção (tabela+id). Se omitido no apply, exige aplicarTodos=true.',
    type: [ReparoNomeMedicoSelecaoDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReparoNomeMedicoSelecaoDto)
  itensSelecionados?: ReparoNomeMedicoSelecaoDto[];

  @ApiPropertyOptional({
    description:
      'Se true no apply sem itensSelecionados, aplica todos os “a corrigir” do escopo.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  aplicarTodos?: boolean;
}

export class ReparoNomeMedicoItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  tabela!: string;

  @ApiPropertyOptional({ nullable: true })
  unidade!: string | null;

  @ApiProperty()
  crm!: string;

  @ApiProperty()
  uf!: string;

  @ApiProperty()
  nomeAtual!: string;

  @ApiPropertyOptional({ nullable: true })
  nomeErp!: string | null;

  @ApiPropertyOptional()
  origemErp?: string;

  @ApiProperty()
  motivo!: string;

  @ApiProperty()
  acao!: 'corrigir' | 'pendente' | 'sem_crm' | 'igual';
}

export class RepararNomesMedicosResponseDto {
  @ApiProperty()
  aplicar!: boolean;

  @ApiPropertyOptional({ enum: Unidade, nullable: true })
  unidadeFiltro!: Unidade | null;

  @ApiProperty()
  totalAnalisado!: number;

  @ApiProperty()
  suspeitos!: number;

  @ApiProperty()
  aCorrigir!: number;

  @ApiProperty()
  corrigidos!: number;

  @ApiProperty()
  pendentes!: number;

  @ApiProperty()
  semCrm!: number;

  @ApiProperty()
  iguais!: number;

  @ApiProperty({ type: [String] })
  agentesConsultados!: string[];

  @ApiProperty({ type: [String] })
  erros!: string[];

  @ApiProperty({
    description: 'Todos os itens elegíveis à correção (para checkbox/seleção)',
    type: [ReparoNomeMedicoItemDto],
  })
  paraCorrigir!: ReparoNomeMedicoItemDto[];

  @ApiProperty({
    description: 'Relatório completo de pendentes (+ sem CRM quando suspeito)',
    type: [ReparoNomeMedicoItemDto],
  })
  pendentesRelatorio!: ReparoNomeMedicoItemDto[];
}

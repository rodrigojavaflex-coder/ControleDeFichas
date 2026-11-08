import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';

export class AtualizarDataNascimentoPrescritoresDto {
  @ApiProperty({
    description: 'false = prévia; true = grava todas as datas divergentes',
    default: false,
  })
  @IsBoolean()
  aplicar!: boolean;

  @ApiPropertyOptional({ enum: Unidade })
  @IsOptional()
  @IsEnum(Unidade)
  unidade?: Unidade;
}

export class AtualizarDataNascimentoItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  unidade!: string;

  @ApiProperty()
  crm!: string;

  @ApiProperty()
  uf!: string;

  @ApiProperty()
  pfcrm!: string;

  @ApiProperty()
  nome!: string;

  @ApiPropertyOptional({ nullable: true })
  dataAtual!: string | null;

  @ApiProperty()
  dataErp!: string;
}

export class AtualizarDataNascimentoPrescritoresResponseDto {
  @ApiProperty()
  aplicar!: boolean;

  @ApiPropertyOptional({ nullable: true })
  unidadeFiltro!: Unidade | null;

  @ApiProperty()
  totalNest!: number;

  @ApiProperty()
  paraAtualizar!: number;

  @ApiProperty()
  atualizados!: number;

  @ApiProperty()
  iguais!: number;

  @ApiProperty()
  semDataErp!: number;

  @ApiProperty()
  semCrm!: number;

  @ApiProperty()
  semUnidade!: number;

  @ApiProperty()
  semCadastroErp!: number;

  @ApiProperty()
  ambiguos!: number;

  @ApiProperty({ type: [String] })
  agentesConsultados!: string[];

  @ApiProperty({ type: [String] })
  erros!: string[];

  @ApiProperty({ type: [AtualizarDataNascimentoItemDto] })
  itens!: AtualizarDataNascimentoItemDto[];

  @ApiProperty({ type: [String] })
  ambiguosDescricao!: string[];
}

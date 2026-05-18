import {
  IsOptional,
  IsString,
  Length,
  Matches,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsUUID,
  ValidateIf,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';
import { TipoChavePixFolha } from '../../../common/enums/tipo-chave-pix-folha.enum';
import { FuncionarioEventoFixoLinhaDto } from './funcionario-evento-fixo-linha.dto';

const EMAIL_VAZIO_OU_VALIDO =
  /^$|^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export class CreateFuncionarioFolhaDto {
  @ApiProperty()
  @IsString()
  @Length(1, 200)
  nome: string;

  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 14)
  cpf?: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @Length(0, 40)
  telefone?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @Length(0, 500)
  endereco?: string;

  @ApiPropertyOptional({ maxLength: 254 })
  @IsOptional()
  @IsString()
  @Length(0, 254)
  @Matches(EMAIL_VAZIO_OU_VALIDO, { message: 'E-mail inválido' })
  email?: string;

  @ApiProperty({ description: 'YYYY-MM-DD' })
  @IsNotEmpty({ message: 'Data de nascimento é obrigatória.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Data de nascimento deve estar no formato YYYY-MM-DD.',
  })
  dataNascimento: string;

  @ApiProperty({ description: 'YYYY-MM-DD' })
  @IsNotEmpty({ message: 'Data de admissão é obrigatória.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Data de admissão deve estar no formato YYYY-MM-DD.',
  })
  dataAdmissao: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dataDemissao?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'ID do cadastro folha-cargo (opcional).',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v != null && v !== '')
  @IsUUID()
  cargoId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'ID do cadastro folha-setor (opcional).',
  })
  @IsOptional()
  @ValidateIf((_o, v) => v != null && v !== '')
  @IsUUID()
  setorId?: string | null;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  ativo?: boolean;

  @ApiPropertyOptional({ enum: TipoChavePixFolha, nullable: true })
  @IsOptional()
  @IsEnum(TipoChavePixFolha)
  tipoPix?: TipoChavePixFolha | null;

  @ApiPropertyOptional({ maxLength: 200, nullable: true })
  @IsOptional()
  @IsString()
  @Length(0, 200)
  chavePix?: string | null;

  @ApiPropertyOptional({
    type: [FuncionarioEventoFixoLinhaDto],
    description:
      'Eventos fixos (verba + ref + valor). Copiados para a capa na primeira vez que a folha for gerada.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FuncionarioEventoFixoLinhaDto)
  eventosFixos?: FuncionarioEventoFixoLinhaDto[];
}

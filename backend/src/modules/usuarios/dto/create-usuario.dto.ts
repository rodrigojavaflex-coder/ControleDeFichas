import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  IsBoolean,
  IsOptional,
  MinLength,
  IsArray,
  IsEnum,
  IsIn,
  IsUUID,
} from 'class-validator';
import { Permission } from '../../../common/enums/permission.enum';
import { Unidade } from '../../../common/enums/unidade.enum';

export class CreateUsuarioDto {
  @ApiProperty({
    description: 'Nome completo do usuário',
    example: 'João da Silva',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Nome é obrigatório' })
  @IsString({ message: 'Nome deve ser uma string' })
  @MaxLength(100, { message: 'Nome não pode ter mais que 100 caracteres' })
  nome: string;

  @ApiProperty({
    description: 'Email único do usuário',
    example: 'joao@email.com',
    maxLength: 100,
  })
  @IsNotEmpty({ message: 'Email é obrigatório' })
  @IsEmail({}, { message: 'Email deve ter formato válido' })
  @MaxLength(100, { message: 'Email não pode ter mais que 100 caracteres' })
  email: string;

  @ApiProperty({
    description: 'Senha do usuário',
    example: 'senha123',
    minLength: 6,
  })
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @IsString({ message: 'Senha deve ser uma string' })
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres' })
  senha: string;

  @ApiProperty({
    description: 'Status ativo do usuário',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'ativo deve ser verdadeiro ou falso' })
  ativo?: boolean = true;

  @ApiProperty({
    description: 'ID do perfil do usuário',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsNotEmpty({ message: 'perfilId é obrigatório' })
  @IsString({ message: 'perfilId deve ser uma string UUID' })
  perfilId: string;

  @ApiProperty({
    description: 'Tema preferido do usuário',
    example: 'Claro',
    default: 'Claro',
    enum: ['Claro', 'Escuro'],
  })
  @IsOptional()
  @IsString({ message: 'Tema deve ser uma string' })
  @IsIn(['Claro', 'Escuro'], { message: 'Tema deve ser Claro ou Escuro' })
  tema?: string = 'Claro';

  @ApiProperty({
    description: 'Unidade do usuário',
    example: 'INHUMAS',
    enum: Unidade,
    required: false,
  })
  @IsOptional()
  @IsEnum(Unidade, { message: 'Unidade deve ser um valor válido (INHUMAS, NERÓPOLIS, UBERABA)' })
  unidade?: Unidade;

  @ApiProperty({
    description: 'ID do vendedor associado ao usuário',
    example: '550e8400-e29b-41d4-a716-446655440000',
    required: false,
  })
  @IsOptional()
  @IsUUID(4, { message: 'vendedorId deve ser um UUID válido' })
  vendedorId?: string;
}

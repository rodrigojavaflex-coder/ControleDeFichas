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
} from 'class-validator';
import { Permission } from '../../../common/enums/permission.enum';

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
    description: 'Permissões do usuário',
    example: ['user:read', 'user:create'],
    isArray: true,
    enum: Permission,
  })
  @IsOptional()
  @IsArray({ message: 'Permissões devem ser um array' })
  @IsEnum(Permission, { each: true, message: 'Permissão inválida' })
  permissoes?: Permission[] = [];

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
}

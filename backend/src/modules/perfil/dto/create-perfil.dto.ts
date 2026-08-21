import { IsString, IsNotEmpty, IsArray, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import {
  ALL_PERMISSIONS,
  Permission,
} from '../../../common/enums/permission.enum';

const PERMISSOES_VALIDAS = new Set<string>(ALL_PERMISSIONS);

export class CreatePerfilDto {
  @ApiProperty({ example: 'ADMIN', description: 'Nome único do perfil' })
  @IsString()
  @IsNotEmpty()
  nomePerfil: string;

  @ApiProperty({
    isArray: true,
    enum: Permission,
    example: [Permission.PROFILE_CREATE, Permission.PROFILE_READ],
    description: 'Lista de permissões associadas ao perfil',
  })
  @Transform(({ value }) =>
    Array.isArray(value)
      ? value.filter((p): p is Permission => PERMISSOES_VALIDAS.has(p))
      : value,
  )
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissoes: Permission[];
}

import { IsString, IsNotEmpty, IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../../../common/enums/permission.enum';

export class CreatePerfilDto {
  @ApiProperty({ example: 'ADMIN', description: 'Nome único do perfil' })
  @IsString()
  @IsNotEmpty()
  nomePerfil: string;

  @ApiProperty({
    isArray: true,
    enum: Permission,
    example: [Permission.PROFILE_CREATE, Permission.PROFILE_READ],
    description: 'Lista de permissões associadas ao perfil'
  })
  @IsArray()
  @IsEnum(Permission, { each: true })
  permissoes: Permission[];
}

import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class DesvincularUsuariosPerfilDto {
  @ApiProperty({
    description: 'IDs dos usuários a desvincular do perfil',
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  usuarioIds: string[];
}

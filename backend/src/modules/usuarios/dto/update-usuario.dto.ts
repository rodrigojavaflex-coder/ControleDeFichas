import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUsuarioDto } from './create-usuario.dto';

export class UpdateUsuarioDto extends PartialType(CreateUsuarioDto) {
  @ApiProperty({
    description: 'Status ativo do usuário',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'ativo deve ser um boolean' })
  ativo?: boolean;
}

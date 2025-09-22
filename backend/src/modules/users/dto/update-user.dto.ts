import { ApiProperty, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateUserDto } from './create-user.dto';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @ApiProperty({
    description: 'Status ativo do usuário',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isActive deve ser um boolean' })
  isActive?: boolean;
}
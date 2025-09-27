import { IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Senha atual do usuário' })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  currentPassword: string;

  @ApiProperty({ 
    description: 'Nova senha do usuário',
    minLength: 6,
    maxLength: 50,
    pattern: '^(?=.*[A-Za-z])(?=.*\\d)[A-Za-z\\d@$!%*#?&]{6,}$'
  })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  @Matches(
    /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{6,}$/,
    { message: 'A senha deve conter pelo menos uma letra e um número' }
  )
  newPassword: string;

  @ApiProperty({ description: 'Confirmação da nova senha' })
  @IsString()
  @MinLength(6)
  @MaxLength(50)
  confirmPassword: string;
}
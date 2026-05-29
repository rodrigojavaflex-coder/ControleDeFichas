import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResponderWhatsappDto {
  @ApiProperty({ maxLength: 4096 })
  @IsString()
  @IsNotEmpty({ message: 'Informe o texto da mensagem.' })
  @MaxLength(4096)
  texto: string;
}

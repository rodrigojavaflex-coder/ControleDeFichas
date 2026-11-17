import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Min } from 'class-validator';

export class EnviarMidiaDto {
  @ApiProperty({ enum: ['imagem', 'audio'] })
  @IsIn(['imagem', 'audio'], {
    message: 'Tipo de mídia inválido.',
  })
  tipo: 'imagem' | 'audio';

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Duração do áudio inválida.' })
  @Min(0, { message: 'Duração do áudio inválida.' })
  duracaoMs?: number;
}

import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, MaxLength, MinLength } from 'class-validator';

function texto(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.trim();
}

export class ResolverSolicitacaoDto {
  @ApiProperty({
    description: 'O que foi feito pelo visitador que registrou a pendência.',
  })
  @Transform(({ value }) => texto(value))
  @IsString()
  @MinLength(1, { message: 'Descreva o que foi feito.' })
  @MaxLength(2000, { message: 'A descrição pode ter no máximo 2000 caracteres.' })
  descricao: string;
}

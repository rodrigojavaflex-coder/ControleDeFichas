import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

function textoObrigatorio(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

export class CreateSolicitacaoDto {
  @ApiProperty({ description: 'Texto da pendência ou solicitação' })
  @Transform(({ value }) => textoObrigatorio(value))
  @IsString({ message: 'Informe o texto da pendência.' })
  @MinLength(1, { message: 'Informe o texto da pendência.' })
  @MaxLength(2000, {
    message: 'A pendência não pode ter mais que 2000 caracteres.',
  })
  texto: string;

  @ApiProperty({ description: 'Tipo da pendência/solicitação' })
  @IsUUID('4', { message: 'Tipo de pendência inválido.' })
  tipoPendenciaId: string;

  @ApiPropertyOptional({
    description: 'Médico (prescritor). Opcional. O visitador é sempre quem registra.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Médico inválido.' })
  prescritorId?: string;
}

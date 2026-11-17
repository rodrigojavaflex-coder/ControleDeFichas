import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

function textoOpcional(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') return undefined;
  const texto = value.trim().replace(/\s+/g, ' ');
  return texto.length === 0 ? null : texto;
}

function textoObrigatorio(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().replace(/\s+/g, ' ');
}

export class EncerrarVisitaDto {
  @ApiProperty({ description: 'Descrição da visita (obrigatória)' })
  @Transform(({ value }) => textoObrigatorio(value))
  @IsString({ message: 'Descrição da visita é obrigatória' })
  @MinLength(1, { message: 'Descrição da visita é obrigatória' })
  @MaxLength(4000, {
    message: 'Descrição não pode ter mais que 4000 caracteres',
  })
  descricao: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => textoOpcional(value))
  @IsString({ message: 'Pendência deve ser um texto' })
  @MaxLength(2000, {
    message: 'Pendência não pode ter mais que 2000 caracteres',
  })
  pendencia?: string | null;

  @ApiPropertyOptional({
    description: 'Obrigatório quando a pendência/solicitação estiver preenchida.',
  })
  @IsOptional()
  @IsUUID('4', { message: 'Tipo de pendência inválido.' })
  tipoPendenciaId?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @Transform(({ value }) => textoOpcional(value))
  @IsString({ message: 'Material deve ser um texto' })
  @MaxLength(2000, {
    message: 'Material não pode ter mais que 2000 caracteres',
  })
  material?: string | null;
}

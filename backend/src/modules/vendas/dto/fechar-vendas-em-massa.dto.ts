import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsDateString, IsOptional, IsUUID } from 'class-validator';

export class FecharVendasEmMassaDto {
  @ApiProperty({
    description: 'Lista de IDs das vendas que serão fechadas',
    type: [String],
    example: ['8f8e2f2d-5b07-4de3-8b5c-6a2cf8a2b1a1'],
  })
  @IsArray({ message: 'vendaIds deve ser uma lista' })
  @ArrayNotEmpty({ message: 'Informe pelo menos uma venda para fechar' })
  @IsUUID('4', { each: true, message: 'Cada venda deve ter um ID válido' })
  vendaIds: string[];

  @ApiProperty({
    description: 'Data em que o fechamento será registrado (YYYY-MM-DD)',
    required: false,
    example: '2025-11-12',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data de fechamento deve ter formato válido (YYYY-MM-DD)' })
  dataFechamento?: string;
}

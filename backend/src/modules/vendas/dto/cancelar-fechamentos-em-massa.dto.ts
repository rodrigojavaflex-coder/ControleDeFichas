import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class CancelarFechamentosEmMassaDto {
  @ApiProperty({
    description: 'Lista de IDs das vendas que terão o fechamento cancelado',
    type: [String],
    example: ['8f8e2f2d-5b07-4de3-8b5c-6a2cf8a2b1a1'],
  })
  @IsArray({ message: 'vendaIds deve ser uma lista' })
  @ArrayNotEmpty({ message: 'Informe pelo menos uma venda para cancelar o fechamento' })
  @IsUUID('4', { each: true, message: 'Cada venda deve ter um ID válido' })
  vendaIds: string[];
}

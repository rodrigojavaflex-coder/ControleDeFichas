import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ArrayNotEmpty, IsUUID, IsDateString } from 'class-validator';

export class RegistrarEnvioDto {
  @ApiProperty({
    description: 'IDs das vendas a terem a data de envio registrada',
    type: [String],
    example: ['uuid-venda-1', 'uuid-venda-2'],
  })
  @IsArray()
  @ArrayNotEmpty({ message: 'Informe ao menos uma venda para registrar envio' })
  @IsUUID('4', { each: true, message: 'Todos os IDs de venda devem ser UUID válidos' })
  vendaIds: string[];

  @ApiProperty({
    description: 'Data do envio (YYYY-MM-DD)',
    example: '2025-11-05',
  })
  @IsDateString({}, { message: 'Data de envio deve ter formato válido (YYYY-MM-DD)' })
  dataEnvio: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsBoolean, IsOptional, IsUUID } from 'class-validator';

export class AtualizarValorCompraDto {
  @ApiProperty({
    description: 'IDs das vendas para atualizar valor de compra',
    example: ['8f8e2f2d-5b07-4de3-8b5c-6a2cf8a2b1a1'],
    type: [String],
  })
  @IsArray({ message: 'vendaIds deve ser uma lista' })
  @ArrayNotEmpty({ message: 'Informe pelo menos uma venda para atualizar' })
  @IsUUID('4', { each: true, message: 'Cada venda deve ter um ID válido' })
  vendaIds: string[];

  @ApiProperty({
    description: 'Se true, atualiza vendas não encontradas no agente usando valor do cliente',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'atualizarComValorCliente deve ser um valor booleano' })
  atualizarComValorCliente?: boolean;
}


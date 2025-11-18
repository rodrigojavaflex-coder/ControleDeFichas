import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { TipoDaBaixa } from '../../../common/enums/baixa.enum';

export class ProcessarBaixasEmMassaDto {
  @ApiProperty({
    description: 'Lista de vendas que receberão baixa',
    example: ['uuid-venda-1', 'uuid-venda-2'],
    type: [String],
  })
  @IsArray({ message: 'A lista de vendas deve ser um array válido' })
  @ArrayMinSize(1, { message: 'Informe ao menos uma venda para processar' })
  @IsUUID('4', { each: true, message: 'Cada ID de venda deve ser um UUID válido' })
  vendaIds: string[];

  @ApiProperty({
    description: 'Tipo da baixa que será aplicada a todas as vendas',
    enum: TipoDaBaixa,
  })
  @IsEnum(TipoDaBaixa, { message: 'Tipo da baixa inválido' })
  tipoDaBaixa: TipoDaBaixa;

  @ApiProperty({
    description: 'Data de referência da baixa (YYYY-MM-DD)',
    example: '2025-11-18',
  })
  @IsDateString({}, { message: 'Data da baixa deve estar no formato YYYY-MM-DD' })
  dataBaixa: string;

  @ApiProperty({
    description: 'Observação opcional aplicada a todas as baixas',
    required: false,
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'Observação deve ser um texto' })
  @MaxLength(500, { message: 'Observação não pode ultrapassar 500 caracteres' })
  observacao?: string;
}

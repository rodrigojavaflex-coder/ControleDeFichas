import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  IsEnum,
  IsNumber,
  IsDateString,
  IsOptional,
  IsPositive,
  MaxLength,
} from 'class-validator';
import { TipoDaBaixa } from '../../../common/enums/baixa.enum';

export class CreateBaixaDto {
  @ApiProperty({
    description: 'ID da venda relacionada',
    example: 'uuid-da-venda',
  })
  @IsNotEmpty({ message: 'ID da venda é obrigatório' })
  @IsUUID('4', { message: 'ID da venda deve ser um UUID válido' })
  idvenda: string;

  @ApiProperty({
    description: 'Tipo da baixa',
    example: TipoDaBaixa.DINHEIRO,
    enum: TipoDaBaixa,
  })
  @IsNotEmpty({ message: 'Tipo da baixa é obrigatório' })
  @IsEnum(TipoDaBaixa, { message: 'Tipo da baixa deve ser um valor válido' })
  tipoDaBaixa: TipoDaBaixa;

  @ApiProperty({
    description: 'Valor da baixa',
    example: 500.00,
  })
  @IsNotEmpty({ message: 'Valor da baixa é obrigatório' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor da baixa deve ser um número válido' })
  @IsPositive({ message: 'Valor da baixa deve ser maior que 0,00' })
  valorBaixa: number;

  @ApiProperty({
    description: 'Data da baixa',
    example: '2025-10-27',
  })
  @IsNotEmpty({ message: 'Data da baixa é obrigatória' })
  @IsDateString({}, { message: 'Data da baixa deve ter formato válido (YYYY-MM-DD)' })
  dataBaixa: string;

  @ApiProperty({
    description: 'Observação da baixa',
    example: 'Pagamento realizado em dinheiro',
    maxLength: 500,
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Observação deve ser uma string' })
  @MaxLength(500, { message: 'Observação não pode ter mais que 500 caracteres' })
  observacao?: string;
}
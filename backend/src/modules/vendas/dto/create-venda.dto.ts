import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsPositive,
} from 'class-validator';
import { VendaOrigem, VendaStatus } from '../../../common/enums/venda.enum';
import { Unidade } from '../../../common/enums/unidade.enum';

export class CreateVendaDto {
  @ApiProperty({
    description: 'Protocolo da venda',
    example: 'VND-2025-001',
    maxLength: 30,
  })
  @IsNotEmpty({ message: 'Protocolo é obrigatório' })
  @IsString({ message: 'Protocolo deve ser uma string' })
  @MaxLength(30, { message: 'Protocolo não pode ter mais que 30 caracteres' })
  protocolo: string;

  @ApiProperty({
    description: 'Data da venda',
    example: '2025-10-25',
  })
  @IsNotEmpty({ message: 'Data da venda é obrigatória' })
  @IsDateString({}, { message: 'Data da venda deve ter formato válido (YYYY-MM-DD)' })
  dataVenda: string;

  @ApiProperty({
    description: 'Data do fechamento da venda',
    example: '2025-10-30',
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === null) ? undefined : value)
  @IsDateString({}, { message: 'Data de fechamento deve ter formato válido (YYYY-MM-DD)' })
  dataFechamento?: string;

  @ApiProperty({
    description: 'Nome do cliente',
    example: 'João da Silva',
    maxLength: 300,
  })
  @IsNotEmpty({ message: 'Cliente é obrigatório' })
  @IsString({ message: 'Cliente deve ser uma string' })
  @MaxLength(300, { message: 'Cliente não pode ter mais que 300 caracteres' })
  cliente: string;

  @ApiProperty({
    description: 'Origem da venda',
    example: VendaOrigem.GOIANIA,
    enum: VendaOrigem,
  })
  @IsNotEmpty({ message: 'Origem é obrigatória' })
  @IsEnum(VendaOrigem, { message: 'Origem deve ser um valor válido' })
  origem: VendaOrigem;

  @ApiProperty({
    description: 'Nome do vendedor',
    example: 'Maria Santos',
    maxLength: 300,
  })
  @IsNotEmpty({ message: 'Vendedor é obrigatório' })
  @IsString({ message: 'Vendedor deve ser uma string' })
  @MaxLength(300, { message: 'Vendedor não pode ter mais que 300 caracteres' })
  vendedor: string;

  @ApiProperty({
    description: 'Valor da compra',
    example: 1500.50,
  })
  @IsNotEmpty({ message: 'Valor da compra é obrigatório' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor da compra deve ser um número válido' })
  @IsPositive({ message: 'Valor da compra deve ser maior que 0,00' })
  valorCompra: number;

  @ApiProperty({
    description: 'Valor pago pelo cliente',
    example: 1500.50,
  })
  @IsNotEmpty({ message: 'Valor do cliente é obrigatório' })
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'Valor do cliente deve ser um número válido' })
  @IsPositive({ message: 'Valor do cliente deve ser maior que 0,00' })
  valorCliente: number;

  @ApiProperty({
    description: 'Observação da venda',
    example: 'Venda realizada com sucesso',
    maxLength: 30,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '') ? null : value)
  @IsString({ message: 'Observação deve ser uma string' })
  @MaxLength(30, { message: 'Observação não pode ter mais que 30 caracteres' })
  observacao?: string;

  @ApiProperty({
    description: 'Status da venda',
    example: VendaStatus.REGISTRADO,
    enum: VendaStatus,
    default: VendaStatus.REGISTRADO,
    required: false,
  })
  @IsOptional()
  @IsEnum(VendaStatus, { message: 'Status deve ser um valor válido' })
  status?: VendaStatus = VendaStatus.REGISTRADO;

  @ApiProperty({
    description: 'Unidade da venda',
    example: 'INHUMAS',
    enum: Unidade,
    required: false,
  })
  @IsOptional()
  @IsEnum(Unidade, { message: 'Unidade deve ser um valor válido (INHUMAS, NERÓPOLIS, UBERABA)' })
  unidade?: Unidade;

  @ApiProperty({
    description: 'Status ativo da venda (texto livre até 300 caracteres)',
    example: 'Venda ativa',
    maxLength: 300,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => (value === '') ? null : value)
  @IsString({ message: 'Ativo deve ser uma string' })
  @MaxLength(300, { message: 'Ativo não pode ter mais que 300 caracteres' })
  ativo?: string;
}
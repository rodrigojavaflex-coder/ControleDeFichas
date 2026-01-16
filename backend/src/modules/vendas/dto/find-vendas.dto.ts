import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsDateString, IsArray } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { VendaOrigem, VendaStatus } from '../../../common/enums/venda.enum';
import { Unidade } from '../../../common/enums/unidade.enum';
import { Type, Transform } from 'class-transformer';

export class FindVendasDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Protocolo da venda',
    example: 'VND-2025-001',
  })
  @IsOptional()
  @IsString({ message: 'Protocolo deve ser uma string' })
  protocolo?: string;

  @ApiPropertyOptional({
    description: 'Nome do cliente',
    example: 'João da Silva',
  })
  @IsOptional()
  @IsString({ message: 'Cliente deve ser uma string' })
  cliente?: string;

  @ApiPropertyOptional({
    description: 'Origem da venda (pode ser array para múltiplas seleções)',
    example: VendaOrigem.GOIANIA,
    enum: VendaOrigem,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      return [value];
    }
    return value;
  })
  @IsEnum(VendaOrigem, { each: true, message: 'Origem deve ser um valor válido' })
  origem?: VendaOrigem | VendaOrigem[];

  @ApiPropertyOptional({
    description: 'Nome do vendedor',
    example: 'Maria Santos',
  })
  @IsOptional()
  @IsString({ message: 'Vendedor deve ser uma string' })
  vendedor?: string;

  @ApiPropertyOptional({
    description: 'Nome do prescritor',
    example: 'Dr. João Almeida',
  })
  @IsOptional()
  @IsString({ message: 'Prescritor deve ser uma string' })
  prescritor?: string;

  @ApiPropertyOptional({
    description: 'Status da venda (pode ser array para múltiplas seleções)',
    example: VendaStatus.REGISTRADO,
    enum: VendaStatus,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      return [value];
    }
    return value;
  })
  @IsEnum(VendaStatus, { each: true, message: 'Status deve ser um valor válido' })
  status?: VendaStatus | VendaStatus[];

  @ApiPropertyOptional({
    description: 'Data inicial da venda',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial deve ter formato válido (YYYY-MM-DD)' })
  dataInicial?: string;

  @ApiPropertyOptional({
    description: 'Data final da venda',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data final deve ter formato válido (YYYY-MM-DD)' })
  dataFinal?: string;

  @ApiPropertyOptional({
    description: 'Data inicial do fechamento',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial de fechamento deve ter formato válido (YYYY-MM-DD)' })
  dataInicialFechamento?: string;

  @ApiPropertyOptional({
    description: 'Data final do fechamento',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data final de fechamento deve ter formato válido (YYYY-MM-DD)' })
  dataFinalFechamento?: string;

  @ApiPropertyOptional({
    description: 'Unidade da venda (pode ser array para múltiplas seleções)',
    example: 'INHUMAS',
    enum: Unidade,
    isArray: true,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (Array.isArray(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim() !== '') {
      return [value];
    }
    return value;
  })
  @IsEnum(Unidade, { each: true, message: 'Unidade deve ser um valor válido' })
  unidade?: Unidade | Unidade[];

  @ApiPropertyOptional({
    description: 'Ativo da venda',
    example: 'PETR4',
  })
  @IsOptional()
  @IsString({ message: 'Ativo deve ser uma string' })
  ativo?: string;

  @ApiPropertyOptional({
    description: 'Data inicial de envio',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial de envio deve ter formato válido (YYYY-MM-DD)' })
  dataInicialEnvio?: string;

  @ApiPropertyOptional({
    description: 'Data final de envio',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data final de envio deve ter formato válido (YYYY-MM-DD)' })
  dataFinalEnvio?: string;
}
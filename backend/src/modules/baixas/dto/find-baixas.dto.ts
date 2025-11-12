import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, IsEnum, IsDateString } from 'class-validator';
import { PaginationDto } from '../../../common/dto/pagination.dto';
import { TipoDaBaixa } from '../../../common/enums/baixa.enum';

export class FindBaixasDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'ID da venda relacionada',
    example: 'uuid-da-venda',
  })
  @IsOptional()
  @IsUUID('4', { message: 'ID da venda deve ser um UUID válido' })
  idvenda?: string;

  @ApiPropertyOptional({
    description: 'Tipo da baixa',
    example: TipoDaBaixa.DINHEIRO,
    enum: TipoDaBaixa,
  })
  @IsOptional()
  @IsEnum(TipoDaBaixa, { message: 'Tipo da baixa deve ser um valor válido' })
  tipoDaBaixa?: TipoDaBaixa;

  @ApiPropertyOptional({
    description: 'Data inicial da baixa',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data inicial deve ter formato válido (YYYY-MM-DD)' })
  dataInicial?: string;

  @ApiPropertyOptional({
    description: 'Data final da baixa',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString({}, { message: 'Data final deve ter formato válido (YYYY-MM-DD)' })
  dataFinal?: string;
}
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConfirmarImportacaoRpsItemDto {
  @ApiProperty({ description: 'ID da venda a atualizar' })
  @IsUUID('4', { message: 'vendaId deve ser um UUID válido' })
  vendaId: string;

  @ApiProperty({
    description: 'Valor do fechamento (valorPago) extraído do RPS',
    example: 82.61,
  })
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2 },
    { message: 'valorPago deve ser um número válido' },
  )
  @Min(0.01, { message: 'valorPago deve ser maior que zero' })
  valorPago: number;

  @ApiPropertyOptional({
    description: 'Nome do arquivo PDF de origem (gravado na observação)',
    example: 'RPS_1609_A_2309_INHUMAS_95499.pdf',
  })
  @IsOptional()
  @IsString({ message: 'arquivoOrigem deve ser uma string' })
  @MaxLength(255, { message: 'arquivoOrigem deve ter no máximo 255 caracteres' })
  arquivoOrigem?: string;
}

export class ConfirmarImportacaoRpsDto {
  @ApiProperty({ type: [ConfirmarImportacaoRpsItemDto] })
  @IsArray()
  @ArrayNotEmpty({ message: 'Informe ao menos um item para gravar' })
  @ValidateNested({ each: true })
  @Type(() => ConfirmarImportacaoRpsItemDto)
  itens: ConfirmarImportacaoRpsItemDto[];
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsNumberString,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class FindFichaTecnicaDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Filtrar por tipo de ficha',
    example: 'MATÉRIA PRIMA',
  })
  @IsOptional()
  @IsString({ message: 'Tipo de ficha deve ser texto' })
  tipoDaFicha?: string;
  @ApiPropertyOptional({
    description: 'Buscar por código da fórmula',
    example: 'FC001',
  })
  @IsOptional()
  @IsString({ message: 'Código deve ser texto' })
  codigoFormulaCerta?: string;

  @ApiPropertyOptional({
    description: 'Buscar por produto',
    example: 'Paracetamol',
  })
  @IsOptional()
  @IsString({ message: 'Produto deve ser texto' })
  produto?: string;

  @ApiPropertyOptional({
    description: 'Buscar por DCB',
    example: 'Paracetamol',
  })
  @IsOptional()
  @IsString({ message: 'DCB deve ser texto' })
  dcb?: string;

  @ApiPropertyOptional({
    description: 'Buscar por revisão',
    example: 'Rev. 01',
  })
  @IsOptional()
  @IsString({ message: 'Revisão deve ser texto' })
  revisao?: string;

  @ApiPropertyOptional({
    description: 'Data de análise inicial',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data inicial deve estar em formato válido (YYYY-MM-DD)' },
  )
  dataInicialAnalise?: string;

  @ApiPropertyOptional({
    description: 'Data de análise final',
    example: '2024-12-31',
  })
  @IsOptional()
  @IsDateString(
    {},
    { message: 'Data final deve estar em formato válido (YYYY-MM-DD)' },
  )
  dataFinalAnalise?: string;

  @ApiPropertyOptional({
    description: 'Busca geral em campos principais',
    example: 'paracetamol',
  })
  @IsOptional()
  @IsString({ message: 'Termo de busca deve ser texto' })
  @Transform(({ value }) => value?.trim())
  search?: string;
}

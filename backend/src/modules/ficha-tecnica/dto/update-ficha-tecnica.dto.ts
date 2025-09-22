import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateFichaTecnicaDto } from './create-ficha-tecnica.dto';
import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFichaTecnicaDto extends PartialType(
  OmitType(CreateFichaTecnicaDto, ['codigoFormulaCerta'] as const)
) {
  @ApiProperty({ 
    description: 'Código único da fórmula inserido pelo usuário', 
    maxLength: 100, 
    example: 'FC001',
    required: false 
  })
  @IsOptional()
  @IsString({ message: 'Código da fórmula certa deve ser texto' })
  @MaxLength(100, { message: 'Código da fórmula certa deve ter no máximo 100 caracteres' })
  codigoFormulaCerta?: string;
}
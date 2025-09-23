import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreateConfiguracaoDto {
  @ApiPropertyOptional({ description: 'Nome do cliente', example: 'Farmácia XYZ' })
  @IsOptional()
  @IsString()
  nomeCliente?: string;

  @ApiPropertyOptional({ description: 'Logo do relatório (caminho/URL)', example: '/uploads/logo.png' })
  @IsOptional()
  @IsString()
  logoRelatorio?: string;

  @ApiPropertyOptional({ description: 'Farmacêutico Responsável', example: 'Dra. Maria Silva - CRF 12345' })
  @IsOptional()
  @IsString()
  farmaceuticoResponsavel?: string;
}

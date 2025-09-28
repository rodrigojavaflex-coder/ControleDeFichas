import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsBoolean } from 'class-validator';

export class CreateConfiguracaoDto {
  @ApiPropertyOptional({
    description: 'Nome do cliente',
    example: 'Farmácia XYZ',
  })
  @IsOptional()
  @IsString()
  nomeCliente?: string;

  @ApiPropertyOptional({
    description: 'Logo do relatório (caminho/URL)',
    example: '/uploads/logo.png',
  })
  @IsOptional()
  @IsString()
  logoRelatorio?: string;

  @ApiPropertyOptional({
    description: 'Farmacêutico Responsável',
    example: 'Dra. Maria Silva - CRF 12345',
  })
  @IsOptional()
  @IsString()
  farmaceuticoResponsavel?: string;

  @ApiPropertyOptional({
    description: 'Auditar consultas (operações READ)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  auditarConsultas?: boolean;

  @ApiPropertyOptional({
    description: 'Auditar login e logout',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  auditarLoginLogOff?: boolean;

  @ApiPropertyOptional({
    description: 'Auditar criações (operações CREATE)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  auditarCriacao?: boolean;

  @ApiPropertyOptional({
    description: 'Auditar alterações (operações UPDATE)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  auditarAlteracao?: boolean;

  @ApiPropertyOptional({
    description: 'Auditar exclusões (operações DELETE)',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  auditarExclusao?: boolean;

  @ApiPropertyOptional({
    description: 'Auditar alterações de senha',
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  auditarSenhaAlterada?: boolean;
}

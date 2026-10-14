import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MobileAppVersionEntryDto {
  @ApiProperty({ example: '1.0.0' })
  version: string;

  @ApiPropertyOptional({
    example: '2026-10-12',
    nullable: true,
  })
  date: string | null;
}

export class MobileVersaoMinimaDto {
  @ApiPropertyOptional({
    description: 'Versão mínima exigida do app (semver). Null = não bloqueia.',
    example: '1.0.0',
    nullable: true,
  })
  versaoMinima: string | null;

  @ApiProperty({
    description: 'Indica se o bloqueio por versão está ativo',
    example: false,
  })
  bloqueioAtivo: boolean;

  @ApiProperty({
    description: 'Catálogo de versões geradas do app',
    type: [MobileAppVersionEntryDto],
  })
  versoes: MobileAppVersionEntryDto[];
}

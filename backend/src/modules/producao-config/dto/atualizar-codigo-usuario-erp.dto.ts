import {
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class AtualizarCodigoUsuarioErpProducaoDto {
  @ApiProperty({ enum: Unidade })
  @IsEnum(Unidade)
  unidade: Unidade;

  @ApiPropertyOptional({
    description: 'Código de usuário no ERP (cdusu); null ou omitido para limpar.',
    example: 1110,
    nullable: true,
  })
  @IsOptional()
  @ValidateIf((_o, v) => v != null && v !== '')
  @IsInt({ message: 'Código usuário ERP deve ser um número inteiro.' })
  @Min(1, { message: 'Código usuário ERP deve ser maior que zero.' })
  codigoUsuarioErp?: number | null;
}

export class AtualizarCodigoUsuarioErpProducaoResponseDto {
  @ApiProperty()
  funcionarioId: string;

  @ApiProperty({ nullable: true })
  codigoUsuarioErp: number | null;
}

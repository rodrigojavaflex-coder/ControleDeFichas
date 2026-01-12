import { ApiProperty } from '@nestjs/swagger';
import { Permission } from '../../../common/enums/permission.enum';
import { Unidade } from '../../../common/enums/unidade.enum';

export class AuthResponseDto {
  @ApiProperty({
    description: 'Token de acesso JWT',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  access_token: string;

  @ApiProperty({
    description: 'Token de refresh',
    example: 'refresh-token-string',
  })
  refresh_token: string;

  @ApiProperty({
    description: 'Tipo do token',
    example: 'Bearer',
    default: 'Bearer',
  })
  token_type: string = 'Bearer';

  @ApiProperty({
    description: 'Tempo de expiração em segundos',
    example: 3600,
  })
  expires_in: number;

  @ApiProperty({
    description: 'Dados do usuário logado',
  })
  user: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
    permissions: Permission[];
    tema: string;
    criadoEm: Date;
    atualizadoEm: Date;
    vendedor?: {
      id: string;
      nome: string;
      unidade: Unidade;
      criadoEm: Date;
      atualizadoEm: Date;
    } | null;
  };
}

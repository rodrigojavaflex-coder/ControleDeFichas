import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsString } from 'class-validator';
import { HOME_SHORTCUTS_MAX } from '../../../common/constants/home-shortcut-ids';

export class UpdateAtalhosHomeDto {
  @ApiProperty({
    description: 'IDs dos atalhos exibidos na tela inicial (ordem preservada)',
    example: ['vendas', 'folha-lancamentos', 'clientes'],
    type: [String],
    maxItems: HOME_SHORTCUTS_MAX,
  })
  @IsArray()
  @ArrayMaxSize(HOME_SHORTCUTS_MAX)
  @IsString({ each: true })
  atalhosHome: string[];
}

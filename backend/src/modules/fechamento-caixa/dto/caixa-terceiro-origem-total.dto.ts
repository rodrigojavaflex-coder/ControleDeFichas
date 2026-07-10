import { ApiProperty } from '@nestjs/swagger';

export class CaixaTerceiroOrigemTotalDto {
  @ApiProperty()
  forma: string;

  @ApiProperty()
  origem: string;

  @ApiProperty()
  qtd: number;

  @ApiProperty()
  liquido: number;
}

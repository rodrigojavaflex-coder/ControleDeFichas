import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsUUID, Max, Min } from 'class-validator';

export class IniciarVisitaDto {
  @ApiProperty()
  @IsUUID('4', { message: 'Médico inválido' })
  prescritorId: string;

  @ApiProperty()
  @IsUUID('4', { message: 'Tipo de visita inválido' })
  tipoVisitaId: string;

  @ApiProperty({ example: -16.357 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Latitude inválida' })
  @Min(-90, { message: 'Latitude inválida' })
  @Max(90, { message: 'Latitude inválida' })
  latitude: number;

  @ApiProperty({ example: -49.293 })
  @Type(() => Number)
  @IsNumber({}, { message: 'Longitude inválida' })
  @Min(-180, { message: 'Longitude inválida' })
  @Max(180, { message: 'Longitude inválida' })
  longitude: number;
}

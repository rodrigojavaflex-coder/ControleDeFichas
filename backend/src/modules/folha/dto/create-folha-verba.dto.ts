import { IsBoolean, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FolhaMovimentoTipo } from '../../../common/enums/folha-movimento-tipo.enum';

export class CreateFolhaVerbaDto {
  @IsString()
  @Length(1, 200)
  descricao: string;

  @IsEnum(FolhaMovimentoTipo)
  tipoMovimento: FolhaMovimentoTipo;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  ativo?: boolean = true;
}

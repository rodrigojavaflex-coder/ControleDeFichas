import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

/** `NAO_REGISTRADA` permanece no enum por compatibilidade; `GET competencias-registradas` retorna só ABERTA ou FECHADA. */
export enum FolhaCompetenciaSituacaoGrid {
  NAO_REGISTRADA = 'NAO_REGISTRADA',
  ABERTA = 'ABERTA',
  FECHADA = 'FECHADA',
}

export class FolhaCompetenciaGridRowDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty({ minimum: 1, maximum: 12 })
  mes: number;

  @ApiProperty({ format: 'uuid' })
  folhaTipoId: string;

  @ApiProperty()
  folhaTipoDescricao: string;

  @ApiProperty({ enum: FolhaCompetenciaSituacaoGrid })
  situacao: FolhaCompetenciaSituacaoGrid;

  @ApiProperty({ nullable: true, format: 'uuid' })
  fechamentoId: string | null;

  @ApiProperty({ nullable: true })
  fechadoEm: string | null;

  /** Data e hora em que a abertura atual foi registrada (ou da última reabertura). */
  @ApiProperty({ nullable: true })
  abertaEm: string | null;
}

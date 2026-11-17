import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { StatusSolicitacao } from '../enums/status-solicitacao.enum';

function texto(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  return value.trim();
}

export class TratarSolicitacaoDto {
  @ApiProperty({
    enum: [StatusSolicitacao.RESOLVIDA, StatusSolicitacao.REABERTA],
    description: 'Resolvida encaminha ao visitador; reaberta volta para tratamento.',
  })
  @IsIn([StatusSolicitacao.RESOLVIDA, StatusSolicitacao.REABERTA], {
    message: 'Situação da pendência inválida.',
  })
  status: StatusSolicitacao.RESOLVIDA | StatusSolicitacao.REABERTA;

  @ApiProperty({ description: 'O que foi feito, ou o motivo da reabertura.' })
  @Transform(({ value }) => texto(value))
  @IsString()
  @MinLength(1, { message: 'Descreva o que foi feito.' })
  @MaxLength(2000, { message: 'A descrição pode ter no máximo 2000 caracteres.' })
  descricao: string;
}

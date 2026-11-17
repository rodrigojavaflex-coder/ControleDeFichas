import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { Unidade } from '../../../common/enums/unidade.enum';
import { StatusSolicitacao } from '../enums/status-solicitacao.enum';

function textoBusca(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const texto = value.trim().replace(/\s+/g, ' ');
  return texto.length === 0 ? undefined : texto;
}

const SITUACOES = [
  StatusSolicitacao.ABERTA,
  StatusSolicitacao.RESOLVIDA,
  StatusSolicitacao.CONCLUIDA,
  StatusSolicitacao.REABERTA,
  'todas',
] as const;

export class FindGestaoSolicitacoesDto {
  @ApiPropertyOptional({
    enum: SITUACOES,
    default: 'todas',
    description: 'Sem filtro = todas.',
  })
  @IsOptional()
  @IsIn(SITUACOES, { message: 'Situação da pendência inválida.' })
  status?: StatusSolicitacao | 'todas';

  @ApiPropertyOptional({ enum: Unidade, description: 'Ignorado quando o usuário tem unidade.' })
  @IsOptional()
  @IsIn(Object.values(Unidade), { message: 'Unidade inválida.' })
  unidade?: Unidade;

  @ApiPropertyOptional({ description: 'Médico, visitador ou texto' })
  @IsOptional()
  @Transform(({ value }) => textoBusca(value))
  @IsString()
  @MaxLength(80, { message: 'A busca pode ter no máximo 80 caracteres.' })
  busca?: string;
}

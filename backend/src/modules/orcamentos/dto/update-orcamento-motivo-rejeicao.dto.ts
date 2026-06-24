import { PartialType } from '@nestjs/swagger';
import { CreateOrcamentoMotivoRejeicaoDto } from './create-orcamento-motivo-rejeicao.dto';

export class UpdateOrcamentoMotivoRejeicaoDto extends PartialType(
  CreateOrcamentoMotivoRejeicaoDto,
) {}

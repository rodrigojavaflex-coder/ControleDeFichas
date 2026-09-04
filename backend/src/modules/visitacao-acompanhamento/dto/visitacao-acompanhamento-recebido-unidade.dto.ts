import { ApiProperty } from '@nestjs/swagger';
import { Unidade } from '../../../common/enums/unidade.enum';

export class VisitacaoAcompanhamentoRecebidoUnidadeDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty({ description: 'Recebido da carteira nessa unidade (RN-VIS-008).' })
  valor: number;

  @ApiProperty({ description: 'Quantidade de requisições nessa unidade.' })
  quantidade: number;
}

/** Bloco de outra filial no card TOTAL (só unidades marcadas na meta). */
export class VisitacaoAcompanhamentoOutraUnidadeDto {
  @ApiProperty({ enum: Unidade })
  unidade: Unidade;

  @ApiProperty()
  valorRecebido: number;

  @ApiProperty()
  quantidadeRecebido: number;

  @ApiProperty()
  valorRejeitado: number;

  @ApiProperty()
  quantidadeRejeitado: number;
}

import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { VendaOrigem } from '../../../common/enums/venda.enum';
import { CaixaFechamentoLinhaTipo } from '../enums/caixa-fechamento-status.enum';
import { CaixaFechamento } from './caixa-fechamento.entity';

@Entity('caixa_fechamento_linha')
@Index('idx_caixa_fech_linha_fechamento', ['fechamentoId'])
export class CaixaFechamentoLinha extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'linha de fechamento de caixa';
  }

  @Column({ type: 'uuid', name: 'fechamento_id' })
  fechamentoId: string;

  @ManyToOne(() => CaixaFechamento, (f) => f.linhas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'fechamento_id' })
  fechamento: CaixaFechamento;

  @ApiProperty({ example: 'DINHEIRO' })
  @Column({ type: 'varchar', length: 30 })
  forma: string;

  @ApiProperty({ enum: CaixaFechamentoLinhaTipo })
  @Column({ type: 'varchar', length: 20, name: 'tipo_linha' })
  tipoLinha: CaixaFechamentoLinhaTipo;

  @ApiProperty({ enum: VendaOrigem, required: false })
  @Column({ type: 'varchar', length: 30, nullable: true })
  origem: VendaOrigem | null;

  @Column({ type: 'integer', default: 0 })
  qtd: number;

  @Column({
    type: 'decimal',
    precision: 12,
    scale: 2,
    transformer: {
      from: (v: string) => parseFloat(v),
      to: (v: number) => v,
    },
  })
  valor: number;
}

import { Entity, Column, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { FolhaMovimentoTipo } from '../../../common/enums/folha-movimento-tipo.enum';
import { FolhaItem } from './folha-item.entity';

@Entity('folha_verba')
export class FolhaVerba extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'verba';
  }

  @ApiProperty()
  @Column({ length: 200 })
  descricao: string;

  @ApiProperty({ enum: FolhaMovimentoTipo })
  @Column({ type: 'enum', enum: FolhaMovimentoTipo })
  tipoMovimento: FolhaMovimentoTipo;

  @ApiProperty({ default: true })
  @Column({ default: true })
  ativo: boolean;

  /**
   * Evento de receita classificado como comissão (relatórios Folha geral).
   * Sempre false quando tipoMovimento = DESPESA.
   */
  @ApiProperty({ default: false })
  @Column({ default: false })
  ehComissao: boolean;

  @OneToMany(() => FolhaItem, (i) => i.folhaVerba)
  itens?: FolhaItem[];
}

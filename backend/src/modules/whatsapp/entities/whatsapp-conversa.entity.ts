import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Funcionario } from '../../folha/entities/funcionario.entity';
import { WhatsappMensagem } from './whatsapp-mensagem.entity';

@Entity('whatsapp_conversa')
export class WhatsappConversa extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'conversa WhatsApp';
  }

  @ApiProperty({ description: 'Telefone E.164 (somente dígitos)' })
  @Column({ type: 'varchar', length: 20, unique: true })
  telefoneOrigem: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 24 })
  telefoneMascarado: string;

  @ApiProperty({ required: false })
  @Column({ type: 'uuid', nullable: true })
  funcionarioId?: string | null;

  @ManyToOne(() => Funcionario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'funcionarioId' })
  funcionario?: Funcionario | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 200, nullable: true })
  nomePerfil?: string | null;

  @ApiProperty({ default: true })
  @Column({ default: true })
  naoLida: boolean;

  @ApiProperty({ required: false })
  @Column({ type: 'timestamptz', nullable: true })
  ultimaMensagemEm?: Date | null;

  @OneToMany(() => WhatsappMensagem, (m) => m.conversa)
  mensagens?: WhatsappMensagem[];
}

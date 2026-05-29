import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { WhatsappConversa } from './whatsapp-conversa.entity';
import { FolhaCapa } from '../../folha/entities/folha-capa.entity';
import { Usuario } from '../../usuarios/entities/usuario.entity';

export enum WhatsappMensagemDirecao {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
}

@Entity('whatsapp_mensagem')
export class WhatsappMensagem extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'mensagem WhatsApp';
  }

  @Column({ type: 'uuid' })
  conversaId: string;

  @ManyToOne(() => WhatsappConversa, (c) => c.mensagens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversaId' })
  conversa: WhatsappConversa;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 128, nullable: true, unique: true })
  wamid?: string | null;

  @ApiProperty({ enum: WhatsappMensagemDirecao })
  @Column({ type: 'varchar', length: 16 })
  direcao: WhatsappMensagemDirecao;

  @ApiProperty({ default: 'text' })
  @Column({ type: 'varchar', length: 32, default: 'text' })
  tipo: string;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  conteudoTexto?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 255, nullable: true })
  nomeArquivo?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 128, nullable: true })
  mimeType?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 128, nullable: true })
  metaMediaId?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 512, nullable: true })
  arquivoPath?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'bytea', nullable: true })
  arquivoConteudo?: Buffer | null;

  @ApiProperty({ required: false })
  @Column({ type: 'timestamptz', nullable: true })
  arquivoExpiraEm?: Date | null;

  @ApiProperty({ default: false })
  @Column({ type: 'boolean', default: false })
  temArquivo: boolean;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 1024, nullable: true })
  legenda?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 32, nullable: true })
  status?: string | null;

  @Column({ type: 'uuid', nullable: true })
  usuarioRespostaId?: string | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'usuarioRespostaId' })
  usuarioResposta?: Usuario | null;

  @Column({ type: 'uuid', nullable: true })
  folhaCapaId?: string | null;

  @ManyToOne(() => FolhaCapa, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'folhaCapaId' })
  folhaCapa?: FolhaCapa | null;

  @Column({ type: 'int', nullable: true })
  erroCodigo?: number | null;

  @Column({ type: 'text', nullable: true })
  erroMensagem?: string | null;

  @Column({ type: 'timestamptz' })
  metaTimestamp: Date;
}

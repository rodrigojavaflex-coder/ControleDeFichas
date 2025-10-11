import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Certificado } from './certificado.entity';

@Entity('laudos')
export class Laudo extends BaseEntity {
  @ApiProperty({
    description: 'Conteúdo do arquivo PDF do laudo',
    type: 'string',
    format: 'binary',
  })
  @Column({ type: 'bytea' })
  arquivo: Buffer;

  @ApiProperty({ description: 'Nome original do arquivo PDF', required: false })
  @Column({ name: 'nome_arquivo', length: 255, nullable: true, default: '' })
  nomeArquivo?: string;

  @ApiProperty({ description: 'Certificado associado' })
  @ManyToOne(() => Certificado, certificado => certificado.laudos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'certificado_id' })
  certificado: Certificado;
}
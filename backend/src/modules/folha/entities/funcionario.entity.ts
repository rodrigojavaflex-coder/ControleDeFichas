import { Entity, Column, ManyToOne, JoinColumn, OneToMany } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';
import { TipoChavePixFolha } from '../../../common/enums/tipo-chave-pix-folha.enum';
import { FolhaCargo } from './folha-cargo.entity';
import { FolhaSetor } from './folha-setor.entity';
import { FolhaFuncionarioEventoFixo } from './folha-funcionario-evento-fixo.entity';

@Entity('funcionarios')
export class Funcionario extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'funcionário';
  }

  @ApiProperty({ example: 'Maria Souza' })
  @Column({ type: 'varchar', length: 200 })
  nome: string;

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty({
    required: false,
    description: 'Código do funcionário no ERP/PCP (cdfun) para produtividade.',
    example: 42,
  })
  @Column({ type: 'integer', nullable: true })
  codigoFuncionarioErp?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 14, nullable: true })
  cpf?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 40, nullable: true })
  telefone?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 500, nullable: true })
  endereco?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 254, nullable: true })
  email?: string | null;

  @ApiProperty({ required: false, description: 'YYYY-MM-DD' })
  @Column({ type: 'date', nullable: true })
  dataNascimento?: string | null;

  @ApiProperty({ required: false, description: 'YYYY-MM-DD' })
  @Column({ type: 'date', nullable: true })
  dataAdmissao?: string | null;

  @ApiProperty({ required: false, description: 'YYYY-MM-DD' })
  @Column({ type: 'date', nullable: true })
  dataDemissao?: string | null;

  @ApiProperty({
    required: false,
    description: 'Cadastro de cargo (folha_cargo); opcional.',
  })
  @ManyToOne(() => FolhaCargo, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cargoId' })
  cargo?: FolhaCargo | null;

  @ApiProperty({
    required: false,
    description: 'Cadastro de setor (folha_setor); opcional.',
  })
  @ManyToOne(() => FolhaSetor, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'setorId' })
  setor?: FolhaSetor | null;

  @ApiProperty({ enum: TipoChavePixFolha, required: false })
  @Column({ type: 'varchar', length: 32, nullable: true })
  tipoPix?: TipoChavePixFolha | null;

  @ApiProperty({ required: false, maxLength: 200 })
  @Column({ type: 'varchar', length: 200, nullable: true })
  chavePix?: string | null;

  @ApiProperty({ default: true })
  @Column({ default: true })
  ativo: boolean;

  @ApiProperty({
    default: false,
    description:
      'Quando true, bloqueia envio de recibo de folha por WhatsApp (individual e em massa, RN-015).',
  })
  @Column({ default: false })
  naoReceberReciboWhatsapp: boolean;

  @OneToMany(() => FolhaFuncionarioEventoFixo, (e) => e.funcionario)
  eventosFixos?: FolhaFuncionarioEventoFixo[];
}

import { Entity, Column, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { FichaTecnica } from '../../ficha-tecnica/entities/ficha-tecnica.entity';
import { Laudo } from './laudo.entity';

@Entity('certificados')
export class Certificado extends BaseEntity {
  /**
   * Nome amigável da entidade para uso em logs de auditoria
   */
  static get nomeAmigavel(): string {
    return 'certificado';
  }

  @ApiProperty({
    description: 'Lote do certificado',
    example: 'LOTE-001',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50 })
  loteDoCertificado: string;

  @ApiProperty({
    description: 'Número do certificado',
    example: 'CERT-001',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50 })
  numeroDoCertificado: string;

  @ApiProperty({
    description: 'Fornecedor',
    example: 'Empresa ABC Ltda',
    maxLength: 200,
  })
  @Column({ type: 'varchar', length: 200 })
  fornecedor: string;

  @ApiProperty({
    description: 'Data do certificado',
    example: '2023-10-01',
  })
  @Column({ type: 'date' })
  dataCertificado: Date;

  @ApiProperty({
    description: 'Quantidade',
    example: '100 kg',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50 })
  quantidade: string;

  @ApiProperty({
    description: 'Data de fabricação',
    example: '2023-09-01',
  })
  @Column({ type: 'date' })
  dataDeFabricacao: Date;

  @ApiProperty({
    description: 'Data de validade',
    example: '2025-09-01',
  })
  @Column({ type: 'date' })
  dataDeValidade: Date;

  @ApiProperty({
    description: 'Número do pedido',
    example: 'PED-001',
    maxLength: 50,
  })
  @Column({ type: 'varchar', length: 50 })
  numeroDoPedido: string;

  @ApiProperty({
    description: 'Peso molecular',
    example: '180.16 g/mol',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  pesoMolecular: string;

  @ApiProperty({
    description: 'Fórmula molecular',
    example: 'C6H12O6',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  formulaMolecular: string;

  @ApiProperty({
    description: 'DCB',
    example: 'Descrição DCB',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  dcb: string;

  @ApiProperty({
    description: 'Nome científico',
    example: 'Nome científico do produto',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  nomeCientifico: string;

  @ApiProperty({
    description: 'Características organolépticas',
    example: 'Cor branca, odor característico',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  caracteristicasOrganolepticas: string;

  @ApiProperty({
    description: 'Solubilidade',
    example: 'Solúvel em água',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  solubilidade: string;

  @ApiProperty({
    description: 'Faixa pH',
    example: '6.5 - 7.5',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  faixaPh: string;

  @ApiProperty({
    description: 'Faixa de fusão',
    example: '150-155°C',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  faixaFusao: string;

  @ApiProperty({
    description: 'Peso',
    example: '1000g',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  peso: string;

  @ApiProperty({
    description: 'Volume',
    example: '1L',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  volume: string;

  @ApiProperty({
    description: 'Densidade sem Compactação (±10%)',
    example: '1.2 g/cm³',
    maxLength: 400,
  })
  @Column({ name: 'densidadeSemCompactacao', type: 'varchar', length: 400 })
  densidadeSemCompactacao: string;

  @ApiProperty({
    description: 'Avaliação do laudo',
    example: 'Aprovado',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  avaliacaoDoLaudo: string;

  @ApiProperty({
    description: 'Cinzase',
    example: '0.5%',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  cinzas: string;

  @ApiProperty({
    description: 'Perda por secagem',
    example: '2.1%',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  perdaPorSecagem: string;

  @OneToMany(() => Laudo, laudo => laudo.certificado)
  laudos: Laudo[];

  @ApiProperty({
    description: 'Infravermelho',
    example: 'Conforme especificação',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  infraVermelho: string;

  @ApiProperty({
    description: 'Ultravioleta',
    example: 'Conforme especificação',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  ultraVioleta: string;

  @ApiProperty({
    description: 'Teor',
    example: '99.5%',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  teor: string;

  @ApiProperty({
    description: 'Conservação',
    example: 'Armazenar em local fresco e seco',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  conservacao: string;

  @ApiProperty({
    description: 'Observação 01',
    example: 'Observação adicional',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  observacao01: string;

  @ApiProperty({
    description: 'Determinação de materiais estranhos',
    example: 'Ausente',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  determinacaoMateriaisEstranhos: string;


  @ApiProperty({
    description: 'Umidade',
    example: '5.2%',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  umidade: string;
  
  @ApiProperty({
    description: 'Pesquisas de contaminação microbiológica',
    example: 'Dentro dos limites',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  pesquisasDeContaminacaoMicrobiologica: string;
  
  @ApiProperty({
    description: 'Caracteres microscópicos',
    example: 'Conforme padrão',
    maxLength: 400,
  })
  @Column({ type: 'varchar', length: 400 })
  caracteresMicroscopicos: string;


  @ApiProperty({
    description: 'Ficha técnica associada ao certificado',
    type: () => FichaTecnica,
  })
  @ManyToOne(() => FichaTecnica, fichaTecnica => fichaTecnica.certificados, { nullable: true })
  @JoinColumn({ name: 'fichaTecnicaId' })
  fichaTecnica: FichaTecnica;
}
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('fichas_tecnicas')
export class FichaTecnica {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'ID único do registro', example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479' })
  id: string;

  @Column({ type: 'varchar', length: 200, unique: true })
  @ApiProperty({ description: 'Código único da fórmula inserido pelo usuário', example: 'FC001', maxLength: 200 })
  codigoFormulaCerta: string;

  // =============================================================================
  // BLOCO 1: INFORMAÇÕES BÁSICAS
  // =============================================================================

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Nome do produto', maxLength: 200, example: 'Paracetamol' })
  produto: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Peso molecular', maxLength: 200, example: '151.16 g/mol' })
  pesoMolecular: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Fórmula molecular', maxLength: 200, example: 'C8H9NO2' })
  formulaMolecular: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'DCB (Denominação Comum Brasileira)', maxLength: 200, example: 'Paracetamol' })
  dcb: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Nome científico', maxLength: 200, example: 'N-(4-hydroxyphenyl)acetamide' })
  nomeCientifico: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Revisão', maxLength: 200, example: 'Rev. 01' })
  revisao: string;

  // =============================================================================
  // BLOCO 2: TESTES - REFERÊNCIA RDC 67/2007 - ITEM 7.3.10
  // =============================================================================


  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Características organolépticas', maxLength: 200, example: 'Pó branco cristalino' })
  caracteristicasOrganolepticas: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Solubilidade', maxLength: 200, example: 'Solúvel em água quente' })
  solubilidade: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Faixa de pH', maxLength: 200, example: '5.3 - 6.5' })
  faixaPh: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Faixa de fusão', maxLength: 200, example: '168-172°C' })
  faixaFusao: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Peso', maxLength: 200, example: '1.5 kg' })
  peso: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Volume', maxLength: 200, example: '500 mL' })
  volume: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Densidade com compactação (±10%)', maxLength: 200, example: '0.85 g/cm³ (±10%)' })
  densidadeComCompactacao: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Avaliação do laudo', maxLength: 200, example: 'Aprovado' })
  avaliacaoDoLaudo: string;

  // =============================================================================
  // BLOCO 3: INFORMAÇÕES ADICIONAIS - TRANSCRITOS DAS REFERÊNCIAS - ITEM 7.3.11
  // =============================================================================

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Cinzas', maxLength: 200, example: '< 0.1%' })
  cinzas: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Perda por secagem', maxLength: 200, example: '< 0.5%' })
  perdaPorSecagem: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Infravermelho', maxLength: 200, example: 'Conforme padrão' })
  infraVermelho: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Ultravioleta', maxLength: 200, example: 'Conforme padrão' })
  ultraVioleta: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Teor', maxLength: 200, example: '99.0 - 101.0%' })
  teor: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Conservação', maxLength: 200, example: 'Ambiente seco e arejado' })
  conservacao: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Observação 01', maxLength: 200, example: 'Material higroscópico' })
  observacao01: string;

  @Column({ type: 'text' })
  @ApiProperty({ description: 'Amostragem', example: 'Amostra coletada conforme procedimento X...' })
  amostragem: string;

  @Column({ type: 'varchar', length: 200 })
  @ApiProperty({ description: 'Referência bibliográfica', maxLength: 200, example: 'Farmacopeia Brasileira 6ª Ed.' })
  referenciaBibliografica: string;

  @Column({ type: 'date' })
  @ApiProperty({ description: 'Data de análise', example: '2025-09-21' })
  dataDeAnalise: Date;


  // ===================== CAMPOS NOVOS SOLICITADOS =====================
  @Column({ type: 'varchar', length: 50, nullable: true })
  @ApiProperty({ description: 'Tipo da ficha', maxLength: 50, example: 'Fitoquímica' })
  tipoDaFicha: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  @ApiProperty({ description: 'Determinação de materiais estranhos', maxLength: 200 })
  determinacaoMateriaisEstranhos: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  @ApiProperty({ description: 'Pesquisas de contaminação microbiológica', maxLength: 200 })
  pesquisasDeContaminacaoMicrobiologica: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  @ApiProperty({ description: 'Umidade', maxLength: 200 })
  umidade: string;


  @Column({ type: 'varchar', length: 200, nullable: true })
  @ApiProperty({ description: 'Caracteres microscópicos', maxLength: 200 })
  caracteresMicroscopicos: string;


  // =============================================================================
  // CAMPOS DE CONTROLE INTERNO
  // =============================================================================

  @CreateDateColumn()
  @ApiProperty({ description: 'Data de criação do registro' })
  createdAt: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Data de última atualização do registro' })
  updatedAt: Date;
}
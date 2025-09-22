import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, IsDateString, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateFichaTecnicaDto {
  @ApiProperty({ 
    description: 'Código único da fórmula inserido pelo usuário', 
    maxLength: 100, 
    example: 'FC001' 
  })
  @IsNotEmpty({ message: 'Código da fórmula certa é obrigatório' })
  @IsString({ message: 'Código da fórmula certa deve ser texto' })
  @MaxLength(100, { message: 'Código da fórmula certa deve ter no máximo 100 caracteres' })
  codigoFormulaCerta: string;

  // =============================================================================
  // BLOCO 1: INFORMAÇÕES BÁSICAS
  // =============================================================================

  @ApiProperty({ description: 'Nome do produto', maxLength: 100, example: 'Paracetamol' })
  @IsNotEmpty({ message: 'Produto é obrigatório' })
  @IsString({ message: 'Produto deve ser texto' })
  @MaxLength(100, { message: 'Produto deve ter no máximo 100 caracteres' })
  produto: string;

  @ApiProperty({ description: 'Peso molecular', maxLength: 100, example: '151.16 g/mol' })
  @IsOptional()
  @IsString({ message: 'Peso molecular deve ser texto' })
  @MaxLength(100, { message: 'Peso molecular deve ter no máximo 100 caracteres' })
  pesoMolecular?: string;

  @ApiProperty({ description: 'Fórmula molecular', maxLength: 100, example: 'C8H9NO2' })
  @IsOptional()
  @IsString({ message: 'Fórmula molecular deve ser texto' })
  @MaxLength(100, { message: 'Fórmula molecular deve ter no máximo 100 caracteres' })
  formulaMolecular?: string;

  @ApiProperty({ description: 'DCB (Denominação Comum Brasileira)', maxLength: 100, example: 'Paracetamol' })
  @IsOptional()
  @IsString({ message: 'DCB deve ser texto' })
  @MaxLength(100, { message: 'DCB deve ter no máximo 100 caracteres' })
  dcb?: string;

  @ApiProperty({ description: 'Nome científico', maxLength: 100, example: 'N-(4-hydroxyphenyl)acetamide' })
  @IsOptional()
  @IsString({ message: 'Nome científico deve ser texto' })
  @MaxLength(100, { message: 'Nome científico deve ter no máximo 100 caracteres' })
  nomeCientifico?: string;

  @ApiProperty({ description: 'Revisão', maxLength: 100, example: 'Rev. 01' })
  @IsOptional()
  @IsString({ message: 'Revisão deve ser texto' })
  @MaxLength(100, { message: 'Revisão deve ter no máximo 100 caracteres' })
  revisao?: string;

  // =============================================================================
  // BLOCO 2: TESTES - REFERÊNCIA RDC 67/2007 - ITEM 7.3.10
  // =============================================================================

  @ApiProperty({ description: 'Análise', maxLength: 100, example: 'Análise química completa' })
  @IsOptional()
  @IsString({ message: 'Análise deve ser texto' })
  @MaxLength(100, { message: 'Análise deve ter no máximo 100 caracteres' })
  analise?: string;

  @ApiProperty({ description: 'Características organolépticas', maxLength: 100, example: 'Pó branco cristalino' })
  @IsOptional()
  @IsString({ message: 'Características organolépticas devem ser texto' })
  @MaxLength(100, { message: 'Características organolépticas devem ter no máximo 100 caracteres' })
  caracteristicasOrganolepticas?: string;

  @ApiProperty({ description: 'Solubilidade', maxLength: 100, example: 'Solúvel em água quente' })
  @IsOptional()
  @IsString({ message: 'Solubilidade deve ser texto' })
  @MaxLength(100, { message: 'Solubilidade deve ter no máximo 100 caracteres' })
  solubilidade?: string;

  @ApiProperty({ description: 'Faixa de pH', maxLength: 100, example: '5.3 - 6.5' })
  @IsOptional()
  @IsString({ message: 'Faixa de pH deve ser texto' })
  @MaxLength(100, { message: 'Faixa de pH deve ter no máximo 100 caracteres' })
  faixaPh?: string;

  @ApiProperty({ description: 'Faixa de fusão', maxLength: 100, example: '168-172°C' })
  @IsOptional()
  @IsString({ message: 'Faixa de fusão deve ser texto' })
  @MaxLength(100, { message: 'Faixa de fusão deve ter no máximo 100 caracteres' })
  faixaFusao?: string;

  @ApiProperty({ description: 'Peso', maxLength: 100, example: '1.5 kg' })
  @IsOptional()
  @IsString({ message: 'Peso deve ser texto' })
  @MaxLength(100, { message: 'Peso deve ter no máximo 100 caracteres' })
  peso?: string;

  @ApiProperty({ description: 'Volume', maxLength: 100, example: '500 mL' })
  @IsOptional()
  @IsString({ message: 'Volume deve ser texto' })
  @MaxLength(100, { message: 'Volume deve ter no máximo 100 caracteres' })
  volume?: string;

  @ApiProperty({ description: 'Densidade com compactação (±10%)', maxLength: 100, example: '0.85 g/cm³ (±10%)' })
  @IsOptional()
  @IsString({ message: 'Densidade com compactação deve ser texto' })
  @MaxLength(100, { message: 'Densidade com compactação deve ter no máximo 100 caracteres' })
  densidadeComCompactacao?: string;

  @ApiProperty({ description: 'Avaliação do laudo', maxLength: 100, example: 'Aprovado' })
  @IsOptional()
  @IsString({ message: 'Avaliação do laudo deve ser texto' })
  @MaxLength(100, { message: 'Avaliação do laudo deve ter no máximo 100 caracteres' })
  avaliacaoDoLaudo?: string;

  // =============================================================================
  // BLOCO 3: INFORMAÇÕES ADICIONAIS - TRANSCRITOS DAS REFERÊNCIAS - ITEM 7.3.11
  // =============================================================================

  @ApiProperty({ description: 'Cinzas', maxLength: 100, example: '< 0.1%' })
  @IsOptional()
  @IsString({ message: 'Cinzas deve ser texto' })
  @MaxLength(100, { message: 'Cinzas deve ter no máximo 100 caracteres' })
  cinzas?: string;

  @ApiProperty({ description: 'Perda por secagem', maxLength: 100, example: '< 0.5%' })
  @IsOptional()
  @IsString({ message: 'Perda por secagem deve ser texto' })
  @MaxLength(100, { message: 'Perda por secagem deve ter no máximo 100 caracteres' })
  perdaPorSecagem?: string;

  @ApiProperty({ description: 'Infravermelho', maxLength: 100, example: 'Conforme padrão' })
  @IsOptional()
  @IsString({ message: 'Infravermelho deve ser texto' })
  @MaxLength(100, { message: 'Infravermelho deve ter no máximo 100 caracteres' })
  infraVermelho?: string;

  @ApiProperty({ description: 'Ultravioleta', maxLength: 100, example: 'Conforme padrão' })
  @IsOptional()
  @IsString({ message: 'Ultravioleta deve ser texto' })
  @MaxLength(100, { message: 'Ultravioleta deve ter no máximo 100 caracteres' })
  ultraVioleta?: string;

  @ApiProperty({ description: 'Teor', maxLength: 100, example: '99.0 - 101.0%' })
  @IsOptional()
  @IsString({ message: 'Teor deve ser texto' })
  @MaxLength(100, { message: 'Teor deve ter no máximo 100 caracteres' })
  teor?: string;

  @ApiProperty({ description: 'Conservação', maxLength: 100, example: 'Ambiente seco e arejado' })
  @IsOptional()
  @IsString({ message: 'Conservação deve ser texto' })
  @MaxLength(100, { message: 'Conservação deve ter no máximo 100 caracteres' })
  conservacao?: string;

  @ApiProperty({ description: 'Observação 01', maxLength: 100, example: 'Material higroscópico' })
  @IsOptional()
  @IsString({ message: 'Observação 01 deve ser texto' })
  @MaxLength(100, { message: 'Observação 01 deve ter no máximo 100 caracteres' })
  observacao01?: string;

  @ApiProperty({ description: 'Amostragem', example: 'Amostra coletada conforme procedimento X...' })
  @IsOptional()
  @IsString({ message: 'Amostragem deve ser texto' })
  amostragem?: string;

  @ApiProperty({ description: 'Referência bibliográfica', maxLength: 100, example: 'Farmacopeia Brasileira 6ª Ed.' })
  @IsOptional()
  @IsString({ message: 'Referência bibliográfica deve ser texto' })
  @MaxLength(100, { message: 'Referência bibliográfica deve ter no máximo 100 caracteres' })
  referenciaBibliografica?: string;

  @ApiProperty({ description: 'Data de análise', example: '2025-09-21' })
  @IsOptional()
  @IsDateString({}, { message: 'Data de análise deve estar em formato válido (YYYY-MM-DD)' })
  dataDeAnalise?: string;
}
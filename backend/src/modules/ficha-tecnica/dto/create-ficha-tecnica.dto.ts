import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength, IsDateString, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateFichaTecnicaDto {
  @ApiProperty({ 
    description: 'Código único da fórmula inserido pelo usuário', 
    maxLength: 200, 
    example: 'FC001' 
  })
  @IsNotEmpty({ message: 'Código da fórmula certa é obrigatório' })
  @IsString({ message: 'Código da fórmula certa deve ser texto' })
  @MaxLength(200, { message: 'Código da fórmula certa deve ter no máximo 200 caracteres' })
  codigoFormulaCerta: string;

  // =============================================================================
  // BLOCO 1: INFORMAÇÕES BÁSICAS
  // =============================================================================

  @ApiProperty({ description: 'Nome do produto', maxLength: 200, example: 'Paracetamol' })
  @IsNotEmpty({ message: 'Produto é obrigatório' })
  @IsString({ message: 'Produto deve ser texto' })
  @MaxLength(200, { message: 'Produto deve ter no máximo 200 caracteres' })
  produto: string;

  @ApiProperty({ description: 'Peso molecular', maxLength: 200, example: '151.16 g/mol' })
  @IsOptional()
  @IsString({ message: 'Peso molecular deve ser texto' })
  @MaxLength(200, { message: 'Peso molecular deve ter no máximo 200 caracteres' })
  pesoMolecular?: string;

  @ApiProperty({ description: 'Fórmula molecular', maxLength: 200, example: 'C8H9NO2' })
  @IsOptional()
  @IsString({ message: 'Fórmula molecular deve ser texto' })
  @MaxLength(200, { message: 'Fórmula molecular deve ter no máximo 200 caracteres' })
  formulaMolecular?: string;

  @ApiProperty({ description: 'DCB (Denominação Comum Brasileira)', maxLength: 200, example: 'Paracetamol' })
  @IsOptional()
  @IsString({ message: 'DCB deve ser texto' })
  @MaxLength(200, { message: 'DCB deve ter no máximo 200 caracteres' })
  dcb?: string;

  @ApiProperty({ description: 'Nome científico', maxLength: 200, example: 'N-(4-hydroxyphenyl)acetamide' })
  @IsOptional()
  @IsString({ message: 'Nome científico deve ser texto' })
  @MaxLength(200, { message: 'Nome científico deve ter no máximo 200 caracteres' })
  nomeCientifico?: string;

  @ApiProperty({ description: 'Revisão', maxLength: 200, example: 'Rev. 01' })
  @IsOptional()
  @IsString({ message: 'Revisão deve ser texto' })
  @MaxLength(200, { message: 'Revisão deve ter no máximo 200 caracteres' })
  revisao?: string;

  // =============================================================================
  // BLOCO 2: TESTES - REFERÊNCIA RDC 67/2007 - ITEM 7.3.10
  // =============================================================================

  @ApiProperty({ description: 'Análise', maxLength: 200, example: 'Análise química completa' })
  @IsOptional()
  @IsString({ message: 'Análise deve ser texto' })
  @MaxLength(200, { message: 'Análise deve ter no máximo 200 caracteres' })

  @ApiProperty({ description: 'Características organolépticas', maxLength: 200, example: 'Pó branco cristalino' })
  @IsOptional()
  @IsString({ message: 'Características organolépticas devem ser texto' })
  @MaxLength(200, { message: 'Características organolépticas devem ter no máximo 200 caracteres' })
  caracteristicasOrganolepticas?: string;

  @ApiProperty({ description: 'Solubilidade', maxLength: 200, example: 'Solúvel em água quente' })
  @IsOptional()
  @IsString({ message: 'Solubilidade deve ser texto' })
  @MaxLength(200, { message: 'Solubilidade deve ter no máximo 200 caracteres' })
  solubilidade?: string;

  @ApiProperty({ description: 'Faixa de pH', maxLength: 200, example: '5.3 - 6.5' })
  @IsOptional()
  @IsString({ message: 'Faixa de pH deve ser texto' })
  @MaxLength(200, { message: 'Faixa de pH deve ter no máximo 200 caracteres' })
  faixaPh?: string;

  @ApiProperty({ description: 'Faixa de fusão', maxLength: 200, example: '168-172°C' })
  @IsOptional()
  @IsString({ message: 'Faixa de fusão deve ser texto' })
  @MaxLength(200, { message: 'Faixa de fusão deve ter no máximo 200 caracteres' })
  faixaFusao?: string;

  @ApiProperty({ description: 'Peso', maxLength: 200, example: '1.5 kg' })
  @IsOptional()
  @IsString({ message: 'Peso deve ser texto' })
  @MaxLength(200, { message: 'Peso deve ter no máximo 200 caracteres' })
  peso?: string;

  @ApiProperty({ description: 'Volume', maxLength: 200, example: '500 mL' })
  @IsOptional()
  @IsString({ message: 'Volume deve ser texto' })
  @MaxLength(200, { message: 'Volume deve ter no máximo 200 caracteres' })
  volume?: string;

  @ApiProperty({ description: 'Densidade com compactação (±10%)', maxLength: 200, example: '0.85 g/cm³ (±10%)' })
  @IsOptional()
  @IsString({ message: 'Densidade com compactação deve ser texto' })
  @MaxLength(200, { message: 'Densidade com compactação deve ter no máximo 200 caracteres' })
  densidadeComCompactacao?: string;

  // ===================== CAMPOS EXTRAS PARA FITOTERÁPICO =====================
  @ApiProperty({ description: 'Tipo da ficha', maxLength: 50, example: 'Fitoquímica' })
  @IsNotEmpty({ message: 'Tipo da ficha é obrigatório' })
  @IsString({ message: 'Tipo da ficha deve ser texto' })
  @MaxLength(50, { message: 'Tipo da ficha deve ter no máximo 50 caracteres' })
  tipoDaFicha: string;
  @ApiProperty({ description: 'Determinação de materiais estranhos', maxLength: 200, example: 'Ausente' })
  @IsOptional()
  @IsString({ message: 'Determinação de materiais estranhos deve ser texto' })
  @MaxLength(200, { message: 'Determinação de materiais estranhos deve ter no máximo 200 caracteres' })
  determinacaoMateriaisEstranhos?: string;

  @ApiProperty({ description: 'Pesquisas de contaminação microbiológica', maxLength: 200, example: 'Ausente' })
  @IsOptional()
  @IsString({ message: 'Pesquisas de contaminação microbiológica deve ser texto' })
  @MaxLength(200, { message: 'Pesquisas de contaminação microbiológica deve ter no máximo 200 caracteres' })
  pesquisasDeContaminacaoMicrobiologica?: string;

  @ApiProperty({ description: 'Umidade', maxLength: 200, example: '8%' })
  @IsOptional()
  @IsString({ message: 'Umidade deve ser texto' })
  @MaxLength(200, { message: 'Umidade deve ter no máximo 200 caracteres' })
  umidade?: string;

  @ApiProperty({ description: 'Caracteres microscópicos', maxLength: 200, example: 'Ausente' })
  @IsOptional()
  @IsString({ message: 'Caracteres microscópicos deve ser texto' })
  @MaxLength(200, { message: 'Caracteres microscópicos deve ter no máximo 200 caracteres' })
  caracteresMicroscopicos?: string;

  @ApiProperty({ description: 'Avaliação do laudo', maxLength: 200, example: 'Aprovado' })
  @IsOptional()
  @IsString({ message: 'Avaliação do laudo deve ser texto' })
  @MaxLength(200, { message: 'Avaliação do laudo deve ter no máximo 200 caracteres' })
  avaliacaoDoLaudo?: string;

  // =============================================================================
  // BLOCO 3: INFORMAÇÕES ADICIONAIS - TRANSCRITOS DAS REFERÊNCIAS - ITEM 7.3.11
  // =============================================================================

  @ApiProperty({ description: 'Cinzas', maxLength: 200, example: '< 0.1%' })
  @IsOptional()
  @IsString({ message: 'Cinzas deve ser texto' })
  @MaxLength(200, { message: 'Cinzas deve ter no máximo 200 caracteres' })
  cinzas?: string;

  @ApiProperty({ description: 'Perda por secagem', maxLength: 200, example: '< 0.5%' })
  @IsOptional()
  @IsString({ message: 'Perda por secagem deve ser texto' })
  @MaxLength(200, { message: 'Perda por secagem deve ter no máximo 200 caracteres' })
  perdaPorSecagem?: string;

  @ApiProperty({ description: 'Infravermelho', maxLength: 200, example: 'Conforme padrão' })
  @IsOptional()
  @IsString({ message: 'Infravermelho deve ser texto' })
  @MaxLength(200, { message: 'Infravermelho deve ter no máximo 200 caracteres' })
  infraVermelho?: string;

  @ApiProperty({ description: 'Ultravioleta', maxLength: 200, example: 'Conforme padrão' })
  @IsOptional()
  @IsString({ message: 'Ultravioleta deve ser texto' })
  @MaxLength(200, { message: 'Ultravioleta deve ter no máximo 200 caracteres' })
  ultraVioleta?: string;

  @ApiProperty({ description: 'Teor', maxLength: 200, example: '99.0 - 101.0%' })
  @IsOptional()
  @IsString({ message: 'Teor deve ser texto' })
  @MaxLength(200, { message: 'Teor deve ter no máximo 200 caracteres' })
  teor?: string;

  @ApiProperty({ description: 'Conservação', maxLength: 200, example: 'Ambiente seco e arejado' })
  @IsOptional()
  @IsString({ message: 'Conservação deve ser texto' })
  @MaxLength(200, { message: 'Conservação deve ter no máximo 200 caracteres' })
  conservacao?: string;

  @ApiProperty({ description: 'Observação 01', maxLength: 200, example: 'Material higroscópico' })
  @IsOptional()
  @IsString({ message: 'Observação 01 deve ser texto' })
  @MaxLength(200, { message: 'Observação 01 deve ter no máximo 200 caracteres' })
  observacao01?: string;

  @ApiProperty({ description: 'Amostragem', example: 'Amostra coletada conforme procedimento X...' })
  @IsOptional()
  @IsString({ message: 'Amostragem deve ser texto' })
  amostragem?: string;

  @ApiProperty({ description: 'Referência bibliográfica', maxLength: 200, example: 'Farmacopeia Brasileira 6ª Ed.' })
  @IsOptional()
  @IsString({ message: 'Referência bibliográfica deve ser texto' })
  @MaxLength(200, { message: 'Referência bibliográfica deve ter no máximo 200 caracteres' })
  referenciaBibliografica?: string;

  @ApiProperty({ description: 'Data de análise', example: '2025-09-21' })
  @IsOptional()
  @IsDateString({}, { message: 'Data de análise deve estar em formato válido (YYYY-MM-DD)' })
  dataDeAnalise?: string;
}
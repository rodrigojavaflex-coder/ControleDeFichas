import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  IsDateString,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class CreateCertificadoDto {
  @ApiProperty({
    description: 'Lote do certificado',
    example: 'LOTE-001',
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Lote do certificado é obrigatório' })
  @IsString({ message: 'Lote do certificado deve ser uma string' })
  @MaxLength(50, { message: 'Lote do certificado não pode ter mais que 50 caracteres' })
  loteDoCertificado: string;

  @ApiProperty({
    description: 'Número do certificado',
    example: 'CERT-001',
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Número do certificado é obrigatório' })
  @IsString({ message: 'Número do certificado deve ser uma string' })
  @MaxLength(50, { message: 'Número do certificado não pode ter mais que 50 caracteres' })
  numeroDoCertificado: string;

  @ApiProperty({
    description: 'Fornecedor',
    example: 'Empresa ABC Ltda',
    maxLength: 200,
  })
  @IsNotEmpty({ message: 'Fornecedor é obrigatório' })
  @IsString({ message: 'Fornecedor deve ser uma string' })
  @MaxLength(200, { message: 'Fornecedor não pode ter mais que 200 caracteres' })
  fornecedor: string;

  @ApiProperty({
    description: 'Data do certificado',
    example: '2023-10-01',
  })
  @IsNotEmpty({ message: 'Data do certificado é obrigatória' })
  @IsDateString({}, { message: 'Data do certificado deve ser uma data válida' })
  dataCertificado: string;

  @ApiProperty({
    description: 'Quantidade',
    example: '100 kg',
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Quantidade é obrigatória' })
  @IsString({ message: 'Quantidade deve ser uma string' })
  @MaxLength(50, { message: 'Quantidade não pode ter mais que 50 caracteres' })
  quantidade: string;

  @ApiProperty({
    description: 'Data de fabricação',
    example: '2023-09-01',
  })
  @IsNotEmpty({ message: 'Data de fabricação é obrigatória' })
  @IsDateString({}, { message: 'Data de fabricação deve ser uma data válida' })
  dataDeFabricacao: string;

  @ApiProperty({
    description: 'Data de validade',
    example: '2025-09-01',
  })
  @IsNotEmpty({ message: 'Data de validade é obrigatória' })
  @IsDateString({}, { message: 'Data de validade deve ser uma data válida' })
  dataDeValidade: string;

  @ApiProperty({
    description: 'Número do pedido',
    example: 'PED-001',
    maxLength: 50,
  })
  @IsNotEmpty({ message: 'Número do pedido é obrigatório' })
  @IsString({ message: 'Número do pedido deve ser uma string' })
  @MaxLength(50, { message: 'Número do pedido não pode ter mais que 50 caracteres' })
  numeroDoPedido: string;

  @ApiProperty({
    description: 'Peso molecular',
    example: '180.16 g/mol',
    maxLength: 400,
    required: false
  })
  @IsOptional()
  @IsString({ message: 'Peso molecular deve ser uma string' })
  @MaxLength(400, { message: 'Peso molecular não pode ter mais que 400 caracteres' })
  pesoMolecular?: string;

  @ApiProperty({
    description: 'Fórmula molecular',
    example: 'C6H12O6',
    maxLength: 400,
  })
  @IsOptional()
  @IsString({ message: 'Fórmula molecular deve ser uma string' })
  @MaxLength(400, { message: 'Fórmula molecular não pode ter mais que 400 caracteres' })
  formulaMolecular?: string;

  @ApiProperty({ description: 'DCB', example: 'Descrição DCB', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'DCB deve ser uma string' })
  @MaxLength(400, { message: 'DCB não pode ter mais que 400 caracteres' })
  dcb?: string;

  @ApiProperty({ description: 'Nome científico', example: 'Nome científico do produto', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Nome científico deve ser uma string' })
  @MaxLength(400, { message: 'Nome científico não pode ter mais que 400 caracteres' })
  nomeCientifico?: string;

  @ApiProperty({ description: 'Características organolépticas', example: 'Cor branca, odor característico', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Características organolépticas deve ser uma string' })
  @MaxLength(400, { message: 'Características organolépticas não pode ter mais que 400 caracteres' })
  caracteristicasOrganolepticas?: string;

  @ApiProperty({ description: 'Solubilidade', example: 'Solúvel em água', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Solubilidade deve ser uma string' })
  @MaxLength(400, { message: 'Solubilidade não pode ter mais que 400 caracteres' })
  solubilidade?: string;

  @ApiProperty({ description: 'Faixa pH', example: '6.5 - 7.5', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Faixa pH deve ser uma string' })
  @MaxLength(400, { message: 'Faixa pH não pode ter mais que 400 caracteres' })
  faixaPh?: string;

  @ApiProperty({ description: 'Faixa de fusão', example: '150-155°C', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Faixa de fusão deve ser uma string' })
  @MaxLength(400, { message: 'Faixa de fusão não pode ter mais que 400 caracteres' })
  faixaFusao?: string;

  @ApiProperty({ description: 'Peso', example: '1000g', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Peso deve ser uma string' })
  @MaxLength(400, { message: 'Peso não pode ter mais que 400 caracteres' })
  peso?: string;

  @ApiProperty({ description: 'Volume', example: '1L', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Volume deve ser uma string' })
  @MaxLength(400, { message: 'Volume não pode ter mais que 400 caracteres' })
  volume?: string;

  @ApiProperty({ description: 'Densidade sem Compactação (±10%)', example: '1.2 g/cm³', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Densidade sem compactação deve ser uma string' })
  @MaxLength(400, { message: 'Densidade sem compactação não pode ter mais que 400 caracteres' })
  densidadeSemCompactacao?: string;

  @ApiProperty({ description: 'Avaliação do laudo', example: 'Aprovado', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Avaliação do laudo deve ser uma string' })
  @MaxLength(400, { message: 'Avaliação do laudo não pode ter mais que 400 caracteres' })
  avaliacaoDoLaudo?: string;

  @ApiProperty({ description: 'Cinzase', example: '0.5%', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Cinzase deve ser uma string' })
  @MaxLength(400, { message: 'Cinzase não pode ter mais que 400 caracteres' })
  cinzas?: string;

  @ApiProperty({ description: 'Perda por secagem', example: '2.1%', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Perda por secagem deve ser uma string' })
  @MaxLength(400, { message: 'Perda por secagem não pode ter mais que 400 caracteres' })
  perdaPorSecagem?: string;

  @ApiProperty({ description: 'Infravermelho', example: 'Conforme especificação', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Infravermelho deve ser uma string' })
  @MaxLength(400, { message: 'Infravermelho não pode ter mais que 400 caracteres' })
  infraVermelho?: string;

  @ApiProperty({ description: 'Ultravioleta', example: 'Conforme especificação', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Ultravioleta deve ser uma string' })
  @MaxLength(400, { message: 'Ultravioleta não pode ter mais que 400 caracteres' })
  ultraVioleta?: string;

  @ApiProperty({ description: 'Teor', example: '99.5%', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Teor deve ser uma string' })
  @MaxLength(400, { message: 'Teor não pode ter mais que 400 caracteres' })
  teor?: string;

  @ApiProperty({ description: 'Conservação', example: 'Armazenar em local fresco e seco', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Conservação deve ser uma string' })
  @MaxLength(400, { message: 'Conservação não pode ter mais que 400 caracteres' })
  conservacao?: string;

  @ApiProperty({ description: 'Observação 01', example: 'Observação adicional', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Observação 01 deve ser uma string' })
  @MaxLength(400, { message: 'Observação 01 não pode ter mais que 400 caracteres' })
  observacao01?: string;

  @ApiProperty({ description: 'Determinação de materiais estranhos', example: 'Ausente', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Determinação de materiais estranhos deve ser uma string' })
  @MaxLength(400, { message: 'Determinação de materiais estranhos não pode ter mais que 400 caracteres' })
  determinacaoMateriaisEstranhos?: string;

  @ApiProperty({ description: 'Pesquisas de contaminação microbiológica', example: 'Dentro dos limites', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Pesquisas de contaminação microbiológica deve ser uma string' })
  @MaxLength(400, { message: 'Pesquisas de contaminação microbiológica não pode ter mais que 400 caracteres' })
  pesquisasDeContaminacaoMicrobiologica?: string;

  @ApiProperty({ description: 'Caracteres microscópicos', example: 'Conforme padrão', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Caracteres microscópicos deve ser uma string' })
  @MaxLength(400, { message: 'Caracteres microscópicos não pode ter mais que 400 caracteres' })
  caracteresMicroscopicos?: string;


  @ApiProperty({ description: 'Umidade', example: '5.2%', maxLength: 400, required: false })
  @IsOptional()
  @IsString({ message: 'Umidade deve ser uma string' })
  @MaxLength(400, { message: 'Umidade não pode ter mais que 400 caracteres' })
  umidade?: string;


  @ApiProperty({ description: 'ID da ficha técnica associada', example: 'uuid-da-ficha-tecnica', format: 'uuid' })
  @IsNotEmpty({ message: 'Ficha técnica é obrigatória' })
  @IsUUID('4', { message: 'Ficha técnica deve ser um UUID válido' })
  fichaTecnicaId: string;
}
import { Entity, Column, Index, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

const dateTransformer = {
  from: (value: string | null) => value,
  to: (value: string | Date | null | undefined) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) {
      if (isNaN(value.getTime())) return null;
      return value.toISOString().split('T')[0];
    }
    return null;
  },
};

@Entity('producao_etapas_resumo')
@Unique('uq_producao_etapa', [
  'unidade',
  'filial',
  'requisicao',
  'formula',
  'codEtapa',
])
@Index('idx_producao_etapa_unidade_data_entrada', ['unidade', 'dataEntrada'])
export class ProducaoEtapaResumo extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'etapa de produção';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 20 })
  unidade: Unidade;

  @ApiProperty()
  @Column({ type: 'integer' })
  filial: number;

  @ApiProperty()
  @Column({ type: 'integer' })
  requisicao: number;

  @ApiProperty()
  @Column({ type: 'varchar', length: 10 })
  formula: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 20 })
  codEtapa: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 200 })
  etapa: string;

  @ApiProperty()
  @Column({ type: 'integer' })
  posicaoEtapa: number;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true })
  codFuncEntrada?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 500, nullable: true })
  funcEntrada?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true })
  codFuncSaida?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 500, nullable: true })
  funcSaida?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'date', nullable: true, transformer: dateTransformer })
  dataEntrada?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 8, nullable: true })
  horaEntrada?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'date', nullable: true, transformer: dateTransformer })
  dataSaida?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 8, nullable: true })
  horaSaida?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true })
  tempoEtapa?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 200, nullable: true })
  formaFarmaceutica?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'numeric', precision: 15, scale: 4, nullable: true })
  quantidade?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 20, nullable: true })
  unidadeMedida?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 200, nullable: true })
  laboratorio?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 200, nullable: true })
  tipoFormula?: string | null;

  @ApiProperty()
  @Column({ type: 'integer', default: 0 })
  qtdPrincipiosAtivos: number;

  @ApiProperty({ required: false })
  @Column({ type: 'text', nullable: true })
  principiosAtivos?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 500, nullable: true })
  embalagem?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 500, nullable: true })
  paciente?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'integer', nullable: true })
  codigoCliente?: number | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 500, nullable: true })
  cliente?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 20, nullable: true })
  crf?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 2, nullable: true })
  ufCrf?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 500, nullable: true })
  nomePrescritor?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'date', nullable: true, transformer: dateTransformer })
  dataRetirada?: string | null;

  @ApiProperty({ required: false })
  @Column({ type: 'varchar', length: 8, nullable: true })
  horaRetirada?: string | null;
}

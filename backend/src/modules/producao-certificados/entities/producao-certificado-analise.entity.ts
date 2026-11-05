import { Entity, Column, Index, Unique } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Unidade } from '../../../common/enums/unidade.enum';

const dateTransformer = {
  from: (value: string | null) => value,
  to: (value: string | Date | null | undefined) => {
    if (!value) return null;
    if (typeof value === 'string') return value.slice(0, 10);
    if (value instanceof Date && !isNaN(value.getTime())) {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
    }
    return null;
  },
};

@Entity('producao_certificado_analise')
@Unique('uq_producao_cert_analise_un_fil_num', [
  'unidade',
  'filial',
  'numeroCertificado',
])
@Index('idx_producao_cert_analise_un_data', ['unidade', 'dataCertificado'])
@Index('idx_producao_cert_analise_un_fun', ['unidade', 'funcionarioCodigo'])
export class ProducaoCertificadoAnalise extends BaseEntity {
  static get nomeAmigavel(): string {
    return 'certificado de análise da produção';
  }

  @ApiProperty({ enum: Unidade })
  @Column({ type: 'varchar', length: 32 })
  unidade: Unidade;

  @ApiProperty()
  @Column({ type: 'integer' })
  filial: number;

  @ApiProperty()
  @Column({ name: 'numero_certificado', type: 'integer' })
  numeroCertificado: number;

  @ApiProperty()
  @Column({
    name: 'data_certificado',
    type: 'date',
    transformer: dateTransformer,
  })
  dataCertificado: string;

  @ApiProperty({ required: false, nullable: true })
  @Column({
    name: 'data_fabricacao',
    type: 'date',
    nullable: true,
    transformer: dateTransformer,
  })
  dataFabricacao: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({
    name: 'data_validade',
    type: 'date',
    nullable: true,
    transformer: dateTransformer,
  })
  dataValidade: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ name: 'codigo_produto', type: 'integer', nullable: true })
  codigoProduto: number | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({
    name: 'tipo_certificado',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  tipoCertificado: string | null;

  /** `CDFUN` do FC21000. A tabela não tem `CDUSU`. */
  @ApiProperty({ required: false, nullable: true })
  @Column({ name: 'funcionario_codigo', type: 'integer', nullable: true })
  funcionarioCodigo: number | null;

  @ApiProperty({ required: false, nullable: true })
  @Column({ name: 'produto_nome', type: 'varchar', length: 200, nullable: true })
  produtoNome: string | null;
}

import { MigrationInterface, QueryRunner } from 'typeorm';

export class ProducaoCertificadosAnalise1750850000000
  implements MigrationInterface
{
  name = 'ProducaoCertificadosAnalise1750850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "producao_certificado_analise" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "criadoEm" TIMESTAMP NOT NULL DEFAULT now(),
        "atualizadoEm" TIMESTAMP NOT NULL DEFAULT now(),
        "unidade" varchar(32) NOT NULL,
        "filial" integer NOT NULL,
        "numero_certificado" integer NOT NULL,
        "data_certificado" date NOT NULL,
        "data_fabricacao" date NULL,
        "data_validade" date NULL,
        "codigo_produto" integer NULL,
        "tipo_certificado" varchar(20) NULL,
        "funcionario_codigo" integer NULL,
        "produto_nome" varchar(200) NULL,
        CONSTRAINT "pk_producao_certificado_analise" PRIMARY KEY ("id"),
        CONSTRAINT "uq_producao_cert_analise_un_fil_num" UNIQUE ("unidade", "filial", "numero_certificado")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_producao_cert_analise_un_data"
      ON "producao_certificado_analise" ("unidade", "data_certificado")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "idx_producao_cert_analise_un_fun"
      ON "producao_certificado_analise" ("unidade", "funcionario_codigo")
    `);

    await queryRunner.query(`
      ALTER TABLE "sincronizacao_config"
      ADD COLUMN IF NOT EXISTS "ultimaModificacaoProducaoCertificados" timestamp NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sincronizacao_config"
      DROP COLUMN IF EXISTS "ultimaModificacaoProducaoCertificados"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_producao_cert_analise_un_fun"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_producao_cert_analise_un_data"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "producao_certificado_analise"
    `);
  }
}

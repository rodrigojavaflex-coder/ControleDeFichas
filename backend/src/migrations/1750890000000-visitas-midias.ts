import { MigrationInterface, QueryRunner } from 'typeorm';

/** Fotos, áudios e documentos da visita de campo. */
export class VisitasMidias1750890000000 implements MigrationInterface {
  name = 'VisitasMidias1750890000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS visitas_midias (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "visitaId" uuid NOT NULL,
        tipo varchar(20) NOT NULL,
        "nomeArquivo" varchar(255) NOT NULL,
        "mimeType" varchar(120) NOT NULL,
        tamanho bigint NOT NULL,
        "dadosBytea" bytea NOT NULL,
        "duracaoMs" integer NULL,
        "criadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_visitas_midias_visita
          FOREIGN KEY ("visitaId") REFERENCES visitas(id) ON DELETE CASCADE,
        CONSTRAINT ck_visitas_midias_tipo CHECK (
          tipo IN ('imagem', 'audio', 'documento')
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_visitas_midias_visita
      ON visitas_midias ("visitaId")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_visitas_midias_visita
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS visitas_midias`);
  }
}

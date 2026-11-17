import { MigrationInterface, QueryRunner } from 'typeorm';

/** Pendência/solicitação independente da visita, com vínculo opcional. */
export class Solicitacoes1750950000000 implements MigrationInterface {
  name = 'Solicitacoes1750950000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS solicitacoes (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        texto text NOT NULL,
        status varchar(20) NOT NULL DEFAULT 'ABERTA',
        "visitaId" uuid NULL,
        "prescritorId" uuid NULL,
        "visitadorId" uuid NULL,
        unidade varchar(32) NULL,
        "criadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_solicitacoes_visita
          FOREIGN KEY ("visitaId") REFERENCES visitas(id) ON DELETE SET NULL,
        CONSTRAINT fk_solicitacoes_prescritor
          FOREIGN KEY ("prescritorId") REFERENCES prescritores(id) ON DELETE SET NULL,
        CONSTRAINT fk_solicitacoes_visitador
          FOREIGN KEY ("visitadorId") REFERENCES usuarios(id) ON DELETE SET NULL,
        CONSTRAINT ck_solicitacoes_status CHECK (status IN ('ABERTA', 'CONCLUIDA')),
        CONSTRAINT ck_solicitacoes_vinculo CHECK (
          "prescritorId" IS NOT NULL OR "visitadorId" IS NOT NULL
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_solicitacoes_visita
      ON solicitacoes ("visitaId")
      WHERE "visitaId" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_solicitacoes_prescritor_status
      ON solicitacoes ("prescritorId", status)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_solicitacoes_visitador_status
      ON solicitacoes ("visitadorId", status)
    `);
    await queryRunner.query(`
      INSERT INTO solicitacoes (
        id, texto, status, "visitaId", "prescritorId", "visitadorId", unidade, "criadoEm", "atualizadoEm"
      )
      SELECT
        uuid_generate_v4(),
        BTRIM(v.pendencia),
        'ABERTA',
        v.id,
        v."prescritorId",
        v."usuarioId",
        v.unidade,
        v."criadoEm",
        CURRENT_TIMESTAMP
      FROM visitas v
      WHERE v.status = 'PENDENCIA_ABERTA'
        AND v.pendencia IS NOT NULL
        AND BTRIM(v.pendencia) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM solicitacoes s WHERE s."visitaId" = v.id
        )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_solicitacoes_visitador_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_solicitacoes_prescritor_status`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_solicitacoes_visita`);
    await queryRunner.query(`DROP TABLE IF EXISTS solicitacoes`);
  }
}

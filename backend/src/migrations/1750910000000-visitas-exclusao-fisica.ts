import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Troca exclusão lógica por física: remove excluidoEm/excluidoPorId
 * e recria índices sem filtro de exclusão.
 * Idempotente para bancos que já rodaram a migração antiga de visitas.
 */
export class VisitasExclusaoFisica1750910000000 implements MigrationInterface {
  name = 'VisitasExclusaoFisica1750910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_visitas_usuario_aberta`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_visitas_prescritor_fim`);

    await queryRunner.query(`
      ALTER TABLE visitas DROP CONSTRAINT IF EXISTS fk_visitas_excluido_por
    `);

    const cols: Array<{ column_name: string }> = await queryRunner.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'visitas'
        AND column_name IN ('excluidoEm', 'excluidoPorId')
    `);
    const nomes = new Set(cols.map((c) => c.column_name));
    if (nomes.has('excluidoEm')) {
      await queryRunner.query(`ALTER TABLE visitas DROP COLUMN "excluidoEm"`);
    }
    if (nomes.has('excluidoPorId')) {
      await queryRunner.query(`ALTER TABLE visitas DROP COLUMN "excluidoPorId"`);
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_visitas_usuario_aberta
      ON visitas ("usuarioId")
      WHERE status = 'ABERTA'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_visitas_prescritor_fim
      ON visitas ("prescritorId", "dataHoraFim")
    `);

    // Bancos que já tinham FK sem CASCADE
    await queryRunner.query(`
      ALTER TABLE visitas_midias DROP CONSTRAINT IF EXISTS fk_visitas_midias_visita
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'visitas_midias'
        ) AND NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_visitas_midias_visita'
        ) THEN
          ALTER TABLE visitas_midias
            ADD CONSTRAINT fk_visitas_midias_visita
            FOREIGN KEY ("visitaId") REFERENCES visitas(id) ON DELETE CASCADE;
        END IF;
      END $$
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_visitas_usuario_aberta`);
    await queryRunner.query(`DROP INDEX IF EXISTS idx_visitas_prescritor_fim`);

    await queryRunner.query(`
      ALTER TABLE visitas
        ADD COLUMN IF NOT EXISTS "excluidoEm" timestamptz NULL,
        ADD COLUMN IF NOT EXISTS "excluidoPorId" uuid NULL
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'fk_visitas_excluido_por'
        ) THEN
          ALTER TABLE visitas
            ADD CONSTRAINT fk_visitas_excluido_por
            FOREIGN KEY ("excluidoPorId") REFERENCES usuarios(id);
        END IF;
      END $$
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_visitas_usuario_aberta
      ON visitas ("usuarioId")
      WHERE status = 'ABERTA' AND "excluidoEm" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_visitas_prescritor_fim
      ON visitas ("prescritorId", "dataHoraFim")
      WHERE "excluidoEm" IS NULL
    `);
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/** Agendamentos futuros no calendário de visitas (app). */
export class VisitaAgendamentos1751010000000 implements MigrationInterface {
  name = 'VisitaAgendamentos1751010000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS visita_agendamentos (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "usuarioId" uuid NOT NULL,
        "prescritorId" uuid NOT NULL,
        unidade varchar(32) NOT NULL,
        data date NOT NULL,
        hora varchar(5) NULL,
        observacao text NULL,
        "criadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_visita_agendamentos_usuario
          FOREIGN KEY ("usuarioId") REFERENCES usuarios(id) ON DELETE CASCADE,
        CONSTRAINT fk_visita_agendamentos_prescritor
          FOREIGN KEY ("prescritorId") REFERENCES prescritores(id),
        CONSTRAINT ck_visita_agendamentos_hora CHECK (
          hora IS NULL OR hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_visita_agendamentos_usuario_data
      ON visita_agendamentos ("usuarioId", data)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS idx_visita_agendamentos_usuario_data`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS visita_agendamentos`);
  }
}

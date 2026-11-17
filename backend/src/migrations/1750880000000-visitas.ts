import { MigrationInterface, QueryRunner } from 'typeorm';

/** Visita de campo: check-in, encerramento e exclusão física. */
export class Visitas1750880000000 implements MigrationInterface {
  name = 'Visitas1750880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS visitas (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "prescritorId" uuid NOT NULL,
        "tipoVisitaId" uuid NOT NULL,
        "usuarioId" uuid NOT NULL,
        unidade varchar(32) NOT NULL,
        "latitudeInicio" double precision NOT NULL,
        "longitudeInicio" double precision NOT NULL,
        "dataHoraInicio" timestamptz NOT NULL,
        "latitudeFim" double precision NULL,
        "longitudeFim" double precision NULL,
        "dataHoraFim" timestamptz NULL,
        status varchar(20) NOT NULL,
        pendencia text NULL,
        material text NULL,
        "criadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "atualizadoEm" timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_visitas_prescritor FOREIGN KEY ("prescritorId") REFERENCES prescritores(id),
        CONSTRAINT fk_visitas_tipo FOREIGN KEY ("tipoVisitaId") REFERENCES tipos_visita(id),
        CONSTRAINT fk_visitas_usuario FOREIGN KEY ("usuarioId") REFERENCES usuarios(id),
        CONSTRAINT ck_visitas_status CHECK (
          status IN ('ABERTA', 'CONCLUIDA', 'PENDENCIA_ABERTA')
        ),
        CONSTRAINT ck_visitas_fim CHECK (
          (status = 'ABERTA' AND "dataHoraFim" IS NULL)
          OR (status <> 'ABERTA' AND "dataHoraFim" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uq_visitas_usuario_aberta
      ON visitas ("usuarioId")
      WHERE status = 'ABERTA'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_visitas_prescritor_fim
      ON visitas ("prescritorId", "dataHoraFim")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS idx_visitas_prescritor_fim`);
    await queryRunner.query(`DROP INDEX IF EXISTS uq_visitas_usuario_aberta`);
    await queryRunner.query(`DROP TABLE IF EXISTS visitas`);
  }
}

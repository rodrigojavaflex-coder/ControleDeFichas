import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Competências já existentes em folha_capa passam a ter abertura implícita
 * (`folha_fechamento` com fechado=false), alinhando RN após exigência de registro prévio.
 */
export class FolhaFechamentoBackfillAbertura1740980000000
  implements MigrationInterface
{
  name = 'FolhaFechamentoBackfillAbertura1740980000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "folha_fechamento" (
        "id",
        "ano",
        "mes",
        "folhaTipoId",
        "unidade",
        "fechado",
        "fechadoEm",
        "fechadoPorId",
        "criadoEm",
        "atualizadoEm"
      )
      SELECT
        uuid_generate_v4(),
        c."ano",
        c."mes",
        c."folhaTipoId",
        f.unidade,
        false,
        NULL,
        NULL,
        CURRENT_TIMESTAMP(6),
        CURRENT_TIMESTAMP(6)
      FROM "folha_capa" c
      INNER JOIN "funcionarios" f ON f.id = c."funcionarioId"
      WHERE NOT EXISTS (
        SELECT 1 FROM "folha_fechamento" ff
        WHERE ff.unidade = f.unidade
          AND ff.ano = c.ano
          AND ff.mes = c.mes
          AND ff."folhaTipoId" = c."folhaTipoId"
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /* Reversível apenas em cenário isolado — não remover linhas criadas pela app após migração. */
    await queryRunner.query(`
      DELETE FROM "folha_fechamento" ff
      WHERE ff.fechado = false
        AND ff."fechadoEm" IS NULL
        AND ff."fechadoPorId" IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM "folha_capa" c
          INNER JOIN "funcionarios" f ON f.id = c."funcionarioId"
          WHERE f.unidade = ff.unidade
            AND c.ano = ff.ano
            AND c.mes = ff.mes
            AND c."folhaTipoId" = ff."folhaTipoId"
        )
    `);
  }
}

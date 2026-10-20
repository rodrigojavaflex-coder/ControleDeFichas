import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Amplia o enum de tipoAtualizacao em vendas com MANUAL e RPS.
 */
export class VendasTipoAtualizacaoManualRps1750800000000
  implements MigrationInterface
{
  name = 'VendasTipoAtualizacaoManualRps1750800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const enumName = await this.resolveEnumName(queryRunner);
    if (!enumName) {
      return;
    }

    await this.addEnumValueIfMissing(queryRunner, enumName, 'MANUAL');
    await this.addEnumValueIfMissing(queryRunner, enumName, 'RPS');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL não remove valores de enum com segurança se já houver uso.
    // Mantém MANUAL/RPS no tipo; rollback funcional não é aplicável sem recriar o enum.
    void queryRunner;
  }

  private async resolveEnumName(
    queryRunner: QueryRunner,
  ): Promise<string | null> {
    const rows: Array<{ typname: string }> = await queryRunner.query(`
      SELECT t.typname
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE e.enumlabel IN ('FORMULA_CERTA_AGENTE', 'VALOR_CLIENTE')
      GROUP BY t.typname
      HAVING COUNT(DISTINCT e.enumlabel) >= 1
      ORDER BY t.typname
      LIMIT 1
    `);
    return rows[0]?.typname ?? null;
  }

  private async addEnumValueIfMissing(
    queryRunner: QueryRunner,
    enumName: string,
    value: string,
  ): Promise<void> {
    const exists: Array<{ exists: boolean }> = await queryRunner.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = $1 AND e.enumlabel = $2
      ) AS exists
      `,
      [enumName, value],
    );

    if (exists[0]?.exists) {
      return;
    }

    await queryRunner.query(
      `ALTER TYPE "${enumName}" ADD VALUE IF NOT EXISTS '${value}'`,
    );
  }
}

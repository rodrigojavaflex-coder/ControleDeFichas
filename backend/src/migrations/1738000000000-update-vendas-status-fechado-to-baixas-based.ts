import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Atualiza vendas com status 'FECHADO' para o status correto baseado no total de baixas:
 * - total baixas = 0 → REGISTRADO
 * - total baixas >= valorCliente → PAGO
 * - 0 < total baixas < valorCliente → PAGO_PARCIAL
 */
export class UpdateVendasStatusFechadoToBaixasBased1738000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const vendasTable = await queryRunner.getTable('vendas');
    if (!vendasTable) {
      return;
    }

    const fechadas = await queryRunner.query(
      `SELECT v.id, COALESCE(CAST(v."valorCliente" AS NUMERIC), 0) as "valorCliente"
       FROM vendas v
       WHERE v.status = 'FECHADO'`
    );

    if (!fechadas || fechadas.length === 0) {
      return;
    }

    for (const row of fechadas) {
      const totalResult = await queryRunner.query(
        `SELECT COALESCE(SUM(CAST(b."valorBaixa" AS NUMERIC)), 0) as total
         FROM baixas b
         WHERE b.idvenda = $1`,
        [row.id]
      );
      const totalPago = parseFloat(totalResult[0]?.total ?? '0');
      const valorCliente = parseFloat(row.valorCliente ?? '0');

      let novoStatus: string;
      if (totalPago === 0) {
        novoStatus = 'REGISTRADO';
      } else if (totalPago >= valorCliente) {
        novoStatus = 'PAGO';
      } else {
        novoStatus = 'PAGO_PARCIAL';
      }

      await queryRunner.query(
        `UPDATE vendas SET status = $1 WHERE id = $2`,
        [novoStatus, row.id]
      );
    }

    console.log(`Migração: ${fechadas.length} venda(s) com status FECHADO atualizada(s) para status baseado em baixas.`);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Não é possível reverter com precisão (qual venda era FECHADO).
    // Deixar vazio.
  }
}

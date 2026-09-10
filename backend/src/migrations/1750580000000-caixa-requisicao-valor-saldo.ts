import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Saldo em aberto da requisição (FC17000.VRSDO).
 * Visitação (RN-VIS-008) não credita receita com saldo > 0 — mesmo recorte do PDF.
 */
export class CaixaRequisicaoValorSaldo1750580000000
  implements MigrationInterface
{
  name = 'CaixaRequisicaoValorSaldo1750580000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('caixa_requisicoes_pagas');
    if (!table) {
      return;
    }
    if (!table.findColumnByName('valor_saldo')) {
      await queryRunner.addColumn(
        'caixa_requisicoes_pagas',
        new TableColumn({
          name: 'valor_saldo',
          type: 'numeric',
          precision: 15,
          scale: 2,
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('caixa_requisicoes_pagas');
    if (!table) {
      return;
    }
    if (table.findColumnByName('valor_saldo')) {
      await queryRunner.dropColumn('caixa_requisicoes_pagas', 'valor_saldo');
    }
  }
}

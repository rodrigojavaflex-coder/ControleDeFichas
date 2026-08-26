import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Tipo da baixa ERP (FC17000.TPRQU) e valor das fórmulas produzidas (FC12100)
 * para cortesia no fechamento e teto do prescritor na visitação.
 */
export class CaixaRequisicaoTipoFormulas1750420000000
  implements MigrationInterface
{
  name = 'CaixaRequisicaoTipoFormulas1750420000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('caixa_requisicoes_pagas');
    if (!table) {
      return;
    }

    if (!table.findColumnByName('tipo_requisicao')) {
      await queryRunner.addColumn(
        'caixa_requisicoes_pagas',
        new TableColumn({
          name: 'tipo_requisicao',
          type: 'varchar',
          length: '2',
          isNullable: true,
        }),
      );
    }

    if (!table.findColumnByName('valor_formulas')) {
      await queryRunner.addColumn(
        'caixa_requisicoes_pagas',
        new TableColumn({
          name: 'valor_formulas',
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
    if (table.findColumnByName('valor_formulas')) {
      await queryRunner.dropColumn('caixa_requisicoes_pagas', 'valor_formulas');
    }
    if (table.findColumnByName('tipo_requisicao')) {
      await queryRunner.dropColumn(
        'caixa_requisicoes_pagas',
        'tipo_requisicao',
      );
    }
  }
}

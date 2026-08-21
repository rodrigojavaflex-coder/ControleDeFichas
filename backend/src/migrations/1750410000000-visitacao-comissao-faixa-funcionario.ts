import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

/**
 * Faixas de comissão passam a ser por representante (funcionário).
 * Remove o seed global. Sem alteração em perfil.permissoes.
 */
export class VisitacaoComissaoFaixaFuncionario1750410000000
  implements MigrationInterface
{
  name = 'VisitacaoComissaoFaixaFuncionario1750410000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('visitacao_comissao_faixa'))) {
      return;
    }
    if (await queryRunner.hasColumn('visitacao_comissao_faixa', 'funcionarioId')) {
      return;
    }

    await queryRunner.query(`DELETE FROM visitacao_comissao_faixa`);

    await queryRunner.addColumn(
      'visitacao_comissao_faixa',
      new TableColumn({
        name: 'funcionarioId',
        type: 'uuid',
        isNullable: false,
      }),
    );

    await queryRunner.createIndex(
      'visitacao_comissao_faixa',
      new TableIndex({
        name: 'idx_visitacao_comissao_faixa_funcionario',
        columnNames: ['funcionarioId'],
      }),
    );

    await queryRunner.createForeignKey(
      'visitacao_comissao_faixa',
      new TableForeignKey({
        name: 'fk_visitacao_comissao_faixa_funcionario',
        columnNames: ['funcionarioId'],
        referencedTableName: 'funcionarios',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('visitacao_comissao_faixa'))) {
      return;
    }
    const table = await queryRunner.getTable('visitacao_comissao_faixa');
    const fk = table?.foreignKeys.find(
      (k) => k.name === 'fk_visitacao_comissao_faixa_funcionario',
    );
    if (fk) {
      await queryRunner.dropForeignKey('visitacao_comissao_faixa', fk);
    }
    const idx = table?.indices.find(
      (i) => i.name === 'idx_visitacao_comissao_faixa_funcionario',
    );
    if (idx) {
      await queryRunner.dropIndex('visitacao_comissao_faixa', idx);
    }
    if (await queryRunner.hasColumn('visitacao_comissao_faixa', 'funcionarioId')) {
      await queryRunner.dropColumn('visitacao_comissao_faixa', 'funcionarioId');
    }
  }
}

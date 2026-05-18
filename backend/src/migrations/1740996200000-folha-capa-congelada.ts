import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

/**
 * Congelamento por capa: impede alteração de itens e cadastro do funcionário
 * enquanto `congelada = true` (com lote aberto — validação na aplicação).
 */
export class FolhaCapaCongelada1740996200000 implements MigrationInterface {
  name = 'FolhaCapaCongelada1740996200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('folha_capa', [
      new TableColumn({
        name: 'congelada',
        type: 'boolean',
        default: false,
        isNullable: false,
      }),
      new TableColumn({
        name: 'congeladaEm',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'congeladaPorId',
        type: 'uuid',
        isNullable: true,
      }),
    ]);

    await queryRunner.createForeignKey(
      'folha_capa',
      new TableForeignKey({
        name: 'FK_folha_capa_congelada_por',
        columnNames: ['congeladaPorId'],
        referencedTableName: 'usuarios',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropForeignKey('folha_capa', 'FK_folha_capa_congelada_por');
    await queryRunner.dropColumn('folha_capa', 'congeladaPorId');
    await queryRunner.dropColumn('folha_capa', 'congeladaEm');
    await queryRunner.dropColumn('folha_capa', 'congelada');
  }
}

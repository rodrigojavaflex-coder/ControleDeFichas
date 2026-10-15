import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from 'typeorm';

export class UsuarioFuncionarioComercial1750700000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const usuariosTable = await queryRunner.getTable('usuarios');
    if (!usuariosTable) {
      throw new Error('Tabela usuarios não existe.');
    }

    const funcionariosTable = await queryRunner.getTable('funcionarios');
    if (!funcionariosTable) {
      throw new Error('Tabela funcionarios não existe.');
    }

    if (!usuariosTable.findColumnByName('funcionarioId')) {
      await queryRunner.addColumn(
        'usuarios',
        new TableColumn({
          name: 'funcionarioId',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    const tableAposColuna = await queryRunner.getTable('usuarios');
    const fkExiste = (tableAposColuna?.foreignKeys || []).some(
      (fk) => fk.name === 'FK_usuarios_funcionario',
    );
    if (!fkExiste) {
      await queryRunner.createForeignKey(
        'usuarios',
        new TableForeignKey({
          columnNames: ['funcionarioId'],
          referencedTableName: 'funcionarios',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
          name: 'FK_usuarios_funcionario',
        }),
      );
    }

    await queryRunner.query(`
      UPDATE usuarios u
      SET "funcionarioId" = f.id
      FROM vendedores v
      INNER JOIN funcionarios f
        ON f."codigoVendedorErp" = v."cdVendedor"
      WHERE u."vendedorId" = v.id
        AND u."funcionarioId" IS NULL
        AND f.unidade::text = COALESCE(u.unidade::text, v.unidade::text)
        AND v."cdVendedor" IS NOT NULL
        AND v."cdVendedor" > 0
        AND f."codigoVendedorErp" IS NOT NULL
        AND f."codigoVendedorErp" > 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const usuariosTable = await queryRunner.getTable('usuarios');
    if (!usuariosTable) {
      return;
    }

    const fk = (usuariosTable.foreignKeys || []).find(
      (item) => item.name === 'FK_usuarios_funcionario',
    );
    if (fk) {
      await queryRunner.dropForeignKey('usuarios', fk);
    }

    if (usuariosTable.findColumnByName('funcionarioId')) {
      await queryRunner.dropColumn('usuarios', 'funcionarioId');
    }
  }
}

import { MigrationInterface, QueryRunner } from 'typeorm';

/** Localização só no início da visita; remove coords de encerramento. */
export class DropVisitaCoordsFim1751020000000 implements MigrationInterface {
  name = 'DropVisitaCoordsFim1751020000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const tabela = await queryRunner.getTable('visitas');
    if (!tabela) return;

    if (tabela.findColumnByName('latitudeFim')) {
      await queryRunner.query(
        `ALTER TABLE visitas DROP COLUMN IF EXISTS "latitudeFim"`,
      );
    }
    if (tabela.findColumnByName('longitudeFim')) {
      await queryRunner.query(
        `ALTER TABLE visitas DROP COLUMN IF EXISTS "longitudeFim"`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tabela = await queryRunner.getTable('visitas');
    if (!tabela) return;

    if (!tabela.findColumnByName('latitudeFim')) {
      await queryRunner.query(
        `ALTER TABLE visitas ADD COLUMN "latitudeFim" double precision NULL`,
      );
    }
    if (!tabela.findColumnByName('longitudeFim')) {
      await queryRunner.query(
        `ALTER TABLE visitas ADD COLUMN "longitudeFim" double precision NULL`,
      );
    }
  }
}

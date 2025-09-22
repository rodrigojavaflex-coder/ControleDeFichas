import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIdToPrimaryKeyFichasTecnicas1732500000000 implements MigrationInterface {
  name = 'AddIdToPrimaryKeyFichasTecnicas1732500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Adicionar coluna id como UUID
    await queryRunner.query(
      `ALTER TABLE "fichas_tecnicas" ADD COLUMN "id" uuid NOT NULL DEFAULT uuid_generate_v4()`
    );

    // 2. Remover a constraint PRIMARY KEY da coluna codigoFormulaCerta
    await queryRunner.query(
      `ALTER TABLE "fichas_tecnicas" DROP CONSTRAINT "PK_fichas_tecnicas"`
    );

    // 3. Adicionar PRIMARY KEY na coluna id
    await queryRunner.query(
      `ALTER TABLE "fichas_tecnicas" ADD CONSTRAINT "PK_fichas_tecnicas" PRIMARY KEY ("id")`
    );

    // 4. Modificar codigoFormulaCerta para ser VARCHAR e permitir que seja preenchido pelo usuário
    await queryRunner.query(
      `ALTER TABLE "fichas_tecnicas" ALTER COLUMN "codigoFormulaCerta" DROP DEFAULT`
    );
    
    await queryRunner.query(
      `ALTER TABLE "fichas_tecnicas" ALTER COLUMN "codigoFormulaCerta" TYPE VARCHAR(100)`
    );

    // 5. Adicionar constraint UNIQUE no codigoFormulaCerta para garantir unicidade
    await queryRunner.query(
      `ALTER TABLE "fichas_tecnicas" ADD CONSTRAINT "UQ_fichas_tecnicas_codigoFormulaCerta" UNIQUE ("codigoFormulaCerta")`
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverter as mudanças
    await queryRunner.query(
      `ALTER TABLE "fichas_tecnicas" DROP CONSTRAINT "UQ_fichas_tecnicas_codigoFormulaCerta"`
    );
    
    await queryRunner.query(
      `ALTER TABLE "fichas_tecnicas" ALTER COLUMN "codigoFormulaCerta" TYPE BIGINT USING "codigoFormulaCerta"::BIGINT`
    );
    
    await queryRunner.query(
      `ALTER TABLE "fichas_tecnicas" ALTER COLUMN "codigoFormulaCerta" SET DEFAULT nextval('fichas_tecnicas_codigoFormulaCerta_seq'::regclass)`
    );

    await queryRunner.query(
      `ALTER TABLE "fichas_tecnicas" DROP CONSTRAINT "PK_fichas_tecnicas"`
    );

    await queryRunner.query(
      `ALTER TABLE "fichas_tecnicas" ADD CONSTRAINT "PK_fichas_tecnicas" PRIMARY KEY ("codigoFormulaCerta")`
    );

    await queryRunner.query(`ALTER TABLE "fichas_tecnicas" DROP COLUMN "id"`);
  }
}
import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTemaToUser1732600000000 implements MigrationInterface {
    name = 'AddTemaToUser1732600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD "tema" character varying(10) NOT NULL DEFAULT 'Claro'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "tema"`);
    }

}
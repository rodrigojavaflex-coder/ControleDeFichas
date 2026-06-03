import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
} from 'typeorm';

/** Opt-out de recibo de folha por WhatsApp no cadastro de funcionários (RN-015). */
export class FuncionarioNaoReceberReciboWhatsapp1747925500000
  implements MigrationInterface
{
  name = 'FuncionarioNaoReceberReciboWhatsapp1747925500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'funcionarios',
      new TableColumn({
        name: 'naoReceberReciboWhatsapp',
        type: 'boolean',
        default: false,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('funcionarios', 'naoReceberReciboWhatsapp');
  }
}

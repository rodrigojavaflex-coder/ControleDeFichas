import { MigrationInterface, QueryRunner } from 'typeorm';

const ADMIN = 'admin:full';
const PRODUCAO_CONFIG_READ = 'producao-config:read';
const PERMISSAO = 'producao-produtividade:read';

/** Concede produtividade a perfis admin ou com leitura da configuração de produção. */
export class ProducaoProdutividadePermissaoPerfil1749000003000
  implements MigrationInterface
{
  name = 'ProducaoProdutividadePermissaoPerfil1749000003000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; permissoes: string }[] = await queryRunner.query(
      `SELECT id, permissoes FROM perfil WHERE permissoes IS NOT NULL AND permissoes != ''`,
    );
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const grant =
        list.includes(ADMIN) || list.includes(PRODUCAO_CONFIG_READ);
      if (!grant || list.includes(PERMISSAO)) continue;
      list.push(PERMISSAO);
      await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
        list.join(','),
        row.id,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; permissoes: string }[] = await queryRunner.query(
      `SELECT id, permissoes FROM perfil WHERE permissoes IS NOT NULL AND permissoes != ''`,
    );
    for (const row of rows) {
      const list = row.permissoes
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);
      const next = list.filter((p) => p !== PERMISSAO);
      if (next.length === list.length) continue;
      await queryRunner.query(`UPDATE perfil SET permissoes = $1 WHERE id = $2`, [
        next.join(','),
        row.id,
      ]);
    }
  }
}

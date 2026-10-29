/**
 * Pós-deploy: confere migration 175072 (nome canônico).
 *
 * Uso (cwd backend, env de DB já carregado no shell — não lê .env):
 *   npx ts-node -r tsconfig-paths/register src/scripts/verificar-prescritor-nome-canonico.ts
 *
 * Exit 0 = schema OK; 1 = inconsistente (código novo quebraria).
 */
import { AppDataSource } from '../data-source';

async function colunaExiste(
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await AppDataSource.query(
    `
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = $1
      AND column_name = $2
    LIMIT 1
    `,
    [table, column],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function indiceExiste(name: string): Promise<boolean> {
  const rows = await AppDataSource.query(
    `
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = $1
    LIMIT 1
    `,
    [name],
  );
  return Array.isArray(rows) && rows.length > 0;
}

async function main(): Promise<void> {
  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  const erros: string[] = [];

  // Colunas satélite DEVEM ter sumido
  const drops: Array<{ table: string; column: string }> = [
    { table: 'painel_medicos_representantes', column: 'nomeMedico' },
    { table: 'orcamentos', column: 'nomeMedico' },
    { table: 'caixa_requisicoes_pagas', column: 'nome_medico' },
    { table: 'caixa_requisicao_formula', column: 'nome_medico' },
  ];
  for (const { table, column } of drops) {
    if (await colunaExiste(table, column)) {
      erros.push(
        `Coluna ${table}.${column} ainda existe — migration 175072 não aplicada.`,
      );
    } else {
      console.log(`OK: ${table}.${column} removida`);
    }
  }

  // Retrato / histórico DEVEM manter nome
  const keep: Array<{ table: string; column: string }> = [
    { table: 'visitacao_fechamento_medico', column: 'nome_medico' },
    { table: 'visitacao_fechamento_carteira', column: 'nome_medico' },
    {
      table: 'painel_medicos_representantes_historico',
      column: 'nomeMedico',
    },
  ];
  for (const { table, column } of keep) {
    const hasTable = await AppDataSource.query(
      `
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = $1
      LIMIT 1
      `,
      [table],
    );
    if (!hasTable?.length) {
      console.log(`SKIP: tabela ${table} ausente`);
      continue;
    }
    if (!(await colunaExiste(table, column))) {
      erros.push(
        `Coluna ${table}.${column} sumiu — retrato/histórico deve manter nome.`,
      );
    } else {
      console.log(`OK: ${table}.${column} preservada`);
    }
  }

  if (!(await indiceExiste('uq_prescritores_numero_crm_uf'))) {
    erros.push('Índice uq_prescritores_numero_crm_uf ausente.');
  } else {
    console.log('OK: uq_prescritores_numero_crm_uf');
  }

  const dupes = await AppDataSource.query(`
    SELECT "numeroCRM", UPPER(BTRIM("UFCRM")) AS uf, COUNT(*)::int AS qtd
    FROM prescritores
    WHERE "numeroCRM" IS NOT NULL
      AND "UFCRM" IS NOT NULL
      AND BTRIM("UFCRM") <> ''
    GROUP BY "numeroCRM", UPPER(BTRIM("UFCRM"))
    HAVING COUNT(*) > 1
    LIMIT 10
  `);
  if (dupes?.length) {
    erros.push(
      `Duplicatas CRM+UF em prescritores: ${JSON.stringify(dupes)}`,
    );
  } else {
    console.log('OK: sem duplicatas CRM+UF em prescritores');
  }

  const stats = await AppDataSource.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE "numeroCRM" IS NOT NULL AND "UFCRM" IS NOT NULL
      )::int AS com_crm_uf
    FROM prescritores
  `);
  console.log('prescritores:', stats?.[0] ?? stats);

  if (erros.length) {
    console.error('\nFALHOU:');
    for (const e of erros) console.error(` - ${e}`);
    process.exitCode = 1;
  } else {
    console.log('\nSchema nome canônico OK (pronto para código novo).');
  }

  await AppDataSource.destroy();
}

main().catch(async (err) => {
  console.error(err);
  if (AppDataSource.isInitialized) {
    await AppDataSource.destroy();
  }
  process.exit(1);
});

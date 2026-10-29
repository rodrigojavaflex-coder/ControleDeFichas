/**
 * Pós-deploy: dry-run do reparo de nomes (só prescritores) por unidade.
 *
 * Uso (cwd backend; variáveis no shell — não lê .env):
 *   $env:API_URL="https://api.exemplo"
 *   $env:API_TOKEN="<jwt>"
 *   $env:UNIDADE="UBERABA"
 *   npx ts-node -r tsconfig-paths/register src/scripts/reparar-nomes-medicos-dry-run.ts
 *
 * Exit 0 = dry-run OK (mesmo com candidatos); 1 = HTTP/erro de negócio.
 */
const API_URL = (process.env.API_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);
const API_TOKEN = process.env.API_TOKEN || '';
const UNIDADE = (process.env.UNIDADE || '').trim().toUpperCase();

async function main(): Promise<void> {
  if (!API_TOKEN) {
    console.error('Defina API_TOKEN (JWT com configuracao:access).');
    process.exit(1);
  }
  if (!UNIDADE) {
    console.error('Defina UNIDADE (ex.: UBERABA).');
    process.exit(1);
  }

  const url = `${API_URL}/sincronizacao/reparar-nomes-medicos`;
  console.log(`POST ${url} unidade=${UNIDADE} aplicar=false`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      aplicar: false,
      unidade: UNIDADE,
    }),
  });

  const text = await response.text();
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    console.error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
    process.exit(1);
  }

  if (!response.ok) {
    console.error(`HTTP ${response.status}:`, json);
    if (
      Array.isArray(json.erros) &&
      json.erros.some(
        (e) => typeof e === 'string' && e.includes('404'),
      )
    ) {
      console.error(
        'Dica: agente sem GET /api/v1/prescritores/cadastro — deploy do agent primeiro.',
      );
    }
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        unidadeFiltro: json.unidadeFiltro,
        totalAnalisado: json.totalAnalisado,
        aCorrigir: json.aCorrigir,
        pendentes: json.pendentes,
        suspeitos: json.suspeitos,
        iguais: json.iguais,
        agentesConsultados: json.agentesConsultados,
        erros: json.erros,
        amostraCorrigir: Array.isArray(json.paraCorrigir)
          ? json.paraCorrigir.slice(0, 5)
          : [],
      },
      null,
      2,
    ),
  );

  console.log(
    '\nPróximo: Configuração → Importação → Reparar nomes → Aplicar selecionados.',
  );
  console.log(
    'Validar Visitação ao vivo (JÚLIA / ÁRABE). Retratos fechados mantêm snapshot antigo.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

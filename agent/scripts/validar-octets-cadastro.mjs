#!/usr/bin/env node
/**
 * Smoke-test OCTETS + cadastro de prescritores em UMA unidade (antes do roll-out).
 *
 * Uso (PowerShell, variáveis já no ambiente — não lê .env):
 *   $env:AGENT_URL="https://agente-uberaba.exemplo"
 *   $env:AUTH_TOKEN="..."
 *   node scripts/validar-octets-cadastro.mjs
 *
 * Exit 0 = OK; 1 = falha (404, OCTETS/SQL, encoding suspeito nos fixtures).
 */

const AGENT_URL = (process.env.AGENT_URL || '').replace(/\/$/, '');
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

/** CRM+UF conhecidos (Uberaba) — ajuste via env se necessário. */
const FIXTURES = [
  {
    nrcrm: Number(process.env.OCTETS_CRM_JULIA || 85878),
    ufcrm: (process.env.OCTETS_UF_JULIA || 'MG').toUpperCase(),
    trecho: 'JÚLIA',
    corrompido: /JÉLIA/i,
  },
  {
    nrcrm: Number(process.env.OCTETS_CRM_ARABE || 50837),
    ufcrm: (process.env.OCTETS_UF_ARABE || 'MG').toUpperCase(),
    trecho: 'ÁRABE',
    corrompido: /ÇRABE/i,
  },
];

const HEURISTICA =
  /Ç[BCDFGHJKLMNPQRSTVXZ]|Ã[§£¡©]|\uFFFD|ý|ÿ|Ý|JÉ(?=[A-ZÀ-Ú])/i;

function fail(msg) {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`OK: ${msg}`);
}

async function main() {
  if (!AGENT_URL) fail('Defina AGENT_URL (URL base do agente da unidade).');
  if (!AUTH_TOKEN) fail('Defina AUTH_TOKEN (mesmo token do agente).');

  const url = `${AGENT_URL}/api/v1/prescritores/cadastro`;
  console.log(`Consultando ${url} ...`);

  let response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${AUTH_TOKEN}`,
        Accept: 'application/json',
      },
    });
  } catch (err) {
    fail(`Rede/conexão: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (response.status === 404) {
    fail(
      '404 em /api/v1/prescritores/cadastro — agente antigo. Deploy do agent com OCTETS + cadastro antes do roll-out.',
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    fail(`HTTP ${response.status}: ${body.slice(0, 400)}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    fail('Resposta não é JSON válido.');
  }

  if (!Array.isArray(data)) {
    fail('Esperado array de prescritores.');
  }

  ok(`Cadastro retornou ${data.length} prescritor(es).`);

  if (data.length === 0) {
    fail('Lista vazia — verifique Firebird / CAST OCTETS / FC04000.');
  }

  const amostra = data.slice(0, 20).map((r) => ({
    nrcrm: r.nrcrm,
    ufcrm: r.ufcrm,
    nomemed: r.nomemed,
  }));
  console.log('Amostra (20):', JSON.stringify(amostra, null, 2));

  let suspeitosAmostra = 0;
  for (const r of data.slice(0, 200)) {
    const nome = String(r.nomemed ?? '');
    if (HEURISTICA.test(nome)) suspeitosAmostra++;
  }
  if (suspeitosAmostra > 30) {
    fail(
      `${suspeitosAmostra}/200 nomes com heurística suspeita — OCTETS pode não estar ativo ou DB_CHARSET incorreto.`,
    );
  }
  ok(
    `Heurística suspeita nos primeiros 200: ${suspeitosAmostra} (limite soft 30).`,
  );

  for (const fx of FIXTURES) {
    const row = data.find(
      (r) =>
        Number(r.nrcrm) === fx.nrcrm &&
        String(r.ufcrm ?? '')
          .trim()
          .toUpperCase() === fx.ufcrm,
    );
    if (!row) {
      console.warn(
        `WARN: fixture CRM ${fx.nrcrm}/${fx.ufcrm} não encontrado neste agente (ok se outra unidade).`,
      );
      continue;
    }
    const nome = String(row.nomemed ?? '');
    if (fx.corrompido.test(nome)) {
      fail(
        `CRM ${fx.nrcrm}/${fx.ufcrm}: nome corrompido "${nome}" (esperado conter ${fx.trecho}).`,
      );
    }
    if (!nome.toLocaleUpperCase('pt-BR').includes(fx.trecho)) {
      console.warn(
        `WARN: CRM ${fx.nrcrm}/${fx.ufcrm}: "${nome}" sem trecho ${fx.trecho} — conferir cadastro ERP.`,
      );
    } else {
      ok(`Fixture ${fx.nrcrm}/${fx.ufcrm}: ${nome}`);
    }
  }

  ok('Validação OCTETS/cadastro concluída para esta unidade.');
}

main().catch((err) => {
  fail(err instanceof Error ? err.message : String(err));
});

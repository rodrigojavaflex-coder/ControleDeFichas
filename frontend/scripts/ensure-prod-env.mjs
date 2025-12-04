import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const allowLocalhost =
  process.env.ALLOW_LOCALHOST_PROD_ENV === '1' ||
  process.env.CI === 'false';
const filePath = resolve(
  process.cwd(),
  'src',
  'environments',
  'environment.prod.ts',
);

if (!existsSync(filePath)) {
  console.warn(
    `[env-check] Arquivo ${filePath} não encontrado. Verifique o caminho antes do build.`,
  );
  process.exit(0);
}

const content = readFileSync(filePath, 'utf-8');
const match = content.match(/apiUrl:\s*'([^']+)'/);

if (!match) {
  console.warn(
    '[env-check] Não foi possível localizar apiUrl em environment.prod.ts.',
  );
  process.exit(0);
}

const apiUrl = match[1];

if (!allowLocalhost && /localhost|127\.0\.0\.1/i.test(apiUrl)) {
  console.error(
    `[env-check] environment.prod.ts aponta para ${apiUrl}. Atualize apiUrl para o endpoint público antes de executar "npm run build".`,
  );
  process.exit(1);
}

console.log('[env-check] environment.prod.ts aponta para', apiUrl);


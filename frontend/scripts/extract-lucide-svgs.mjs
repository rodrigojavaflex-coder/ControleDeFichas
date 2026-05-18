/**
 * Gera SVGs inline a partir do bundle CJS do lucide (evita resolver o `module`
 * incorreto do pacote lucide para Vite/ng serve).
 *
 * Pré-requisito (somente para rodar este script):
 *   npm i lucide@0.563.0 -D
 * Uso na pasta frontend:
 *   node scripts/extract-lucide-svgs.mjs
 * Depois copie o trecho gerado para navigation-lucide-svgs.ts.
 */
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const l = require('lucide');

function escapeAttrValue(value) {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function lucideIconNodeToSvg(icon) {
  const inner = icon
    .map(([tag, attrs]) => {
      const attrsStr = Object.entries(attrs)
        .map(([name, val]) => `${name}="${escapeAttrValue(String(val))}"`)
        .join(' ');
      return `<${tag} ${attrsStr} />`;
    })
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
}

const EXPORT_NAMES = [
  'Aperture',
  'BarChart2',
  'Briefcase',
  'CircleCheck',
  'Cog',
  'Eye',
  'FileText',
  'Home',
  'Layers',
  'List',
  'Lock',
  'LogOut',
  'PenLine',
  'Search',
  'ShoppingCart',
  'Shield',
  'SlidersHorizontal',
  'TrendingUp',
  'User',
  'UserCheck',
  'UserPlus',
  'Users',
];

for (const k of EXPORT_NAMES) {
  if (!l[k]) {
    console.error('Export ausente:', k);
    process.exit(1);
  }
}

const featherMap = [
  ['feather-home', 'Home'],
  ['feather-search', 'Search'],
  ['feather-cog', 'Cog'],
  ['feather-file-text', 'FileText'],
  ['feather-bar-chart-2', 'BarChart2'],
  ['feather-layers', 'Layers'],
  ['feather-eye', 'Eye'],
  ['feather-users', 'Users'],
  ['feather-shield', 'Shield'],
  ['feather-sliders', 'SlidersHorizontal'],
  ['feather-shopping-cart', 'ShoppingCart'],
  ['feather-check-circle', 'CircleCheck'],
  ['feather-user', 'User'],
  ['feather-user-check', 'UserCheck'],
  ['feather-user-plus', 'UserPlus'],
  ['feather-briefcase', 'Briefcase'],
  ['feather-aperture', 'Aperture'],
  ['feather-list', 'List'],
  ['feather-edit-3', 'PenLine'],
  ['feather-lock', 'Lock'],
  ['feather-trending-up', 'TrendingUp'],
];

const lines = featherMap.map(
  ([key, lum]) =>
    `  '${key}': ${JSON.stringify(lucideIconNodeToSvg(l[lum]))},\n`,
);

const outfile = join(dirname(fileURLToPath(import.meta.url)), '..', '_lucide-svgs-snippet.tmp.txt');

const body = `
export const NAV_LOGOUT_ICON_SVG_HTML = ${JSON.stringify(lucideIconNodeToSvg(l.LogOut))};

const RAW: Record<string, string> = {
${lines.join('')}};
`;

writeFileSync(outfile, body, 'utf8');
console.log('Escrito:', outfile);

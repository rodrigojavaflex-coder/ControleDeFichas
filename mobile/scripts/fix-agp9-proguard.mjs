/**
 * AGP 9+ rejeita getDefaultProguardFile('proguard-android.txt').
 * Plugins Capacitor antigos ainda usam esse arquivo; este script corrige
 * em node_modules após npm install (e antes do assemble).
 */
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const nodeModules = join(mobileRoot, 'node_modules');
const from = "getDefaultProguardFile('proguard-android.txt')";
const to = "getDefaultProguardFile('proguard-android-optimize.txt')";

function walkGradleFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'dist') continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      walkGradleFiles(full, out);
    } else if (name.endsWith('.gradle') || name.endsWith('.gradle.kts')) {
      out.push(full);
    }
  }
  return out;
}

const files = walkGradleFiles(nodeModules);
let patched = 0;
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  if (!content.includes(from)) continue;
  writeFileSync(file, content.split(from).join(to), 'utf8');
  patched += 1;
  console.log(`AGP9 proguard: ${relative(mobileRoot, file)}`);
}

if (patched === 0) {
  console.log('AGP9 proguard: nenhum arquivo precisava de ajuste.');
} else {
  console.log(`AGP9 proguard: ${patched} arquivo(s) atualizado(s).`);
}

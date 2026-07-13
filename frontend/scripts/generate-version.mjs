import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const outPath = resolve(projectRoot, 'public', 'version.json');

function resolveAppVersion() {
  const fromEnv = process.env.APP_VERSION?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  try {
    const packageJson = JSON.parse(
      readFileSync(resolve(projectRoot, 'package.json'), 'utf8'),
    );
    if (typeof packageJson.version === 'string' && packageJson.version.trim()) {
      return packageJson.version.trim();
    }
  } catch {
    // fallback abaixo
  }

  return '0.0.0';
}

function resolveBuildId() {
  const fromEnv =
    process.env.RENDER_GIT_COMMIT ||
    process.env.SOURCE_VERSION ||
    process.env.GITHUB_SHA ||
    '';
  if (fromEnv) {
    return fromEnv.slice(0, 12);
  }
  try {
    return execSync('git rev-parse --short HEAD', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'local';
  }
}

const buildId = `${resolveBuildId()}-${Date.now()}`;
const version = resolveAppVersion();
const payload = {
  version,
  buildId,
  generatedAt: new Date().toISOString(),
};

const publicDir = dirname(outPath);
if (!existsSync(publicDir)) {
  mkdirSync(publicDir, { recursive: true });
}

writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log('[version] Gerado', outPath, '→', version, buildId);

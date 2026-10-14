import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { Logger } from '@nestjs/common';
import { compareSemver, isValidSemver } from './semver.util';

export interface MobileAppVersionEntry {
  version: string;
  /** Data yyyy-MM-dd quando conhecida */
  date: string | null;
}

interface MobileAppVersionsFile {
  versions?: unknown[];
}

const logger = new Logger('MobileAppVersionsCatalog');

function catalogCandidatePaths(): string[] {
  return [
    join(__dirname, '..', '..', 'data', 'mobile-app-versions.json'),
    join(process.cwd(), 'src', 'data', 'mobile-app-versions.json'),
    join(process.cwd(), 'dist', 'data', 'mobile-app-versions.json'),
    join(process.cwd(), 'dist', 'src', 'data', 'mobile-app-versions.json'),
  ];
}

function resolveWritableCatalogPath(): string {
  for (const filePath of catalogCandidatePaths()) {
    if (existsSync(filePath)) {
      return filePath;
    }
  }
  return join(process.cwd(), 'src', 'data', 'mobile-app-versions.json');
}

function stripBom(raw: string): string {
  return raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
}

function parseEntry(item: unknown): MobileAppVersionEntry | null {
  if (typeof item === 'string') {
    const version = item.trim();
    if (!version || !isValidSemver(version)) {
      return null;
    }
    return { version, date: null };
  }
  if (item && typeof item === 'object') {
    const obj = item as { version?: unknown; date?: unknown };
    const version = String(obj.version ?? '').trim();
    if (!version || !isValidSemver(version)) {
      return null;
    }
    const dateRaw = String(obj.date ?? '').trim();
    const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : null;
    return { version, date };
  }
  return null;
}

function normalizeCatalog(versions: unknown[]): MobileAppVersionEntry[] {
  const byVersion = new Map<string, MobileAppVersionEntry>();
  for (const item of versions) {
    const entry = parseEntry(item);
    if (!entry) {
      continue;
    }
    const prev = byVersion.get(entry.version);
    if (!prev || (!prev.date && entry.date)) {
      byVersion.set(entry.version, entry);
    }
  }
  return Array.from(byVersion.values()).sort((a, b) =>
    compareSemver(b.version, a.version),
  );
}

function readCatalogFromPath(filePath: string): MobileAppVersionEntry[] {
  const raw = stripBom(readFileSync(filePath, 'utf8'));
  const parsed = JSON.parse(raw) as MobileAppVersionsFile;
  const versions = Array.isArray(parsed.versions) ? parsed.versions : [];
  return normalizeCatalog(versions);
}

/** Catálogo atualizado pelo run-emulator-clean.ps1 -NewVersion. Mais recente primeiro. */
export function loadMobileAppVersionsCatalog(): MobileAppVersionEntry[] {
  for (const filePath of catalogCandidatePaths()) {
    if (!existsSync(filePath)) {
      continue;
    }
    try {
      const versions = readCatalogFromPath(filePath);
      if (versions.length > 0) {
        return versions;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.warn(`Falha ao ler catálogo em ${filePath}: ${msg}`);
    }
  }
  return [];
}

export function saveMobileAppVersionsCatalog(
  entries: MobileAppVersionEntry[],
): MobileAppVersionEntry[] {
  const normalized = normalizeCatalog(entries);
  const filePath = resolveWritableCatalogPath();
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  const payload = {
    versions: normalized.map((item) => ({
      version: item.version,
      date: item.date,
    })),
  };
  writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return normalized;
}

export function removeMobileAppVersionFromCatalog(
  version: string,
): MobileAppVersionEntry[] {
  const alvo = version.trim();
  if (!isValidSemver(alvo)) {
    throw new Error('Versão inválida.');
  }
  const remaining = loadMobileAppVersionsCatalog().filter(
    (item) => item.version !== alvo,
  );
  return saveMobileAppVersionsCatalog(remaining);
}

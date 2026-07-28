import type { DataSource } from 'typeorm';

/** AppDataSource CLI fora do Nest (`data-source.ts`); extensão `.js` exigida por `moduleResolution: nodenext`. */
export async function loadAppDataSource(): Promise<DataSource> {
  const { AppDataSource } = await import('../../data-source.js');
  return AppDataSource;
}

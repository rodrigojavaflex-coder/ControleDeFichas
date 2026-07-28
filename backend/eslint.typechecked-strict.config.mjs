// @ts-check
import base from './eslint.config.mjs';
import tseslint from 'typescript-eslint';

/** Endurecimento opcional: reativa no-unsafe-* (dívida técnica ~800 ocorrências legadas). */
export default tseslint.config(...base, {
  rules: {
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
    '@typescript-eslint/restrict-template-expressions': 'warn',
  },
});

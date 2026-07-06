// Flat ESLint config (ESLint 9) shared across backend/, frontend/, and shared/.
// Enforces the Constitution's Code Quality principle: strict TypeScript, no `any`,
// no unused code. Type-aware linting is intentionally omitted to keep linting fast;
// TypeScript's own strict compiler (tsc --noEmit) covers type correctness.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/.wrangler/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      // TypeScript handles undefined-symbol detection; disabling avoids false
      // positives on DOM/Workers globals (fetch, Response, R2Bucket, etc.).
      'no-undef': 'off',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
);

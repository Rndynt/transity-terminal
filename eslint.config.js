import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';

// Server-only dead-code lint config (server/-deadcode-tooling task).
// Deliberately scoped to server/**/*.ts — client/ is out of scope for this
// task, and shared/ is read-only from the server's perspective (client may
// still consume shared/ exports that look "unused" from server/ alone).
export default [
  {
    ignores: [
      'client/**',
      'shared/**',
      'dist/**',
      'build/**',
      'node_modules/**',
      '**/*.test.ts',
      'esbuild.config.js',
      'eslint.config.js',
    ],
  },
  {
    files: ['server/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'unused-imports': unusedImports,
    },
    rules: {
      // Turned off in favor of unused-imports/no-unused-vars (avoids
      // double-reporting the same violation under two rule names).
      '@typescript-eslint/no-unused-vars': 'off',
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
];

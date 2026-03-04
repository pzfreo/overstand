import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

export default tseslint.config(
  {
    ignores: [
      'dist/',
      'node_modules/',
      'coverage/',
      'public/',
      'scripts/',
      '*.config.*',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    // Allow underscore-prefixed variables to be unused (common convention)
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['src-ts/**/*.ts'],
    ignores: ['src-ts/**/*.test.ts'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  },
  {
    files: ['web/**/*.js', 'src-ts/**/*.test.ts'],
    rules: {
      // Vitest globals (describe, test, expect, beforeEach, etc.)
      'no-undef': 'off',
    },
  },
)

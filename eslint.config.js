import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // Allow _prefixed variables/args as intentional "I know it's unused" signal
      '@typescript-eslint/no-unused-vars': ['error', {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },
  {
    // App.tsx orchestrator — freeze at current size, goal is <300 lines.
    // TODO: extract more hooks/controllers until this file hits the 300-line target.
    // See CLAUDE.md for the architectural rules this enforces.
    files: ['src/App.tsx'],
    rules: {
      'max-lines': ['error', { max: 320, skipBlankLines: true, skipComments: true }],
    },
  },
])

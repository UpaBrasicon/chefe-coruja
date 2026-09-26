import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'node_modules']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.node, ...globals.es2023 },
    },
  },
  // ADR 0006: toda chamada a modelo passa pelo gateway de IA. Só ele (e o
  // teste de fumaça do próprio llm.ts) pode importar `completar`.
  {
    files: ['src/**/*.ts'],
    ignores: ['src/gateway/gateway.ts', 'src/lib/llm.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          group: ['**/lib/llm.js', '**/lib/llm'],
          importNames: ['completar'],
          message: 'Chame o modelo por src/gateway/gateway.ts (chamarIA): nenhum dado sai sem desidentificação (ADR 0006).',
        }],
      }],
    },
  },
])

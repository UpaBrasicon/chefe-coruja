import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'landing', 'landing/.next', 'hermes', '**/*.mjs', '**/*.cjs']),
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
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  // Guia do padrão do frontend, 4.5: componente, hook, contexto e lib não
  // importam tela. A regra entrou no ESLint quando a contagem zerou (parte 4.2);
  // a de tela importando peça de outra área fica na catraca
  // (scripts/padrao-frontend.mjs).
  {
    files: ['src/components/**/*.{ts,tsx}', 'src/lib/**/*.{ts,tsx}', 'src/hooks/**/*.{ts,tsx}', 'src/contexts/**/*.{ts,tsx}', 'src/clinico/**/*.{ts,tsx}', 'src/domain/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['@/pages/*', '**/pages/*'], message: 'Componente não importa tela (guia do padrão, 4.5). Mova a peça para src/components, src/lib ou src/hooks.' }],
      }],
    },
  },
])

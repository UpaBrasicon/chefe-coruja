/// <reference types="vite/client" />

// Versão do app injetada no build (ver vite.config.ts) — usada no relato de
// erros do cliente (onda 12). Sem build/define, vale '' em tempo de execução.
declare const __APP_VERSAO__: string

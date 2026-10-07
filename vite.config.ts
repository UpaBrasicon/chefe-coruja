import path from 'path'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Rótulo de versão para o relato de erros do cliente (onda 12): commit curto do
// deploy, ou a versão do package.json quando não houver git. Tudo protegido —
// o build não pode quebrar por causa disto.
function versaoApp(): string {
  const porEnv = process.env.VITE_COMMIT
  if (porEnv) return porEnv
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    try {
      return createRequire(import.meta.url)('./package.json').version ?? ''
    } catch {
      return ''
    }
  }
}

// CSP por ambiente (Fase 0, tarefa 2). O cabeçalho do vercel.json vale para
// todos os ambientes e libera só *.supabase.co; esta meta, gerada no build com
// o VITE_SUPABASE_URL do ambiente, estreita o connect-src ao projeto certo. O
// navegador aplica as duas políticas (vale a interseção): produção só fala com
// o banco de produção, homologação só com o de homologação.
// Sentry (Fase 0, item 11): host de ingestão da região UE, o mesmo do DSN em src/lib/sentry.ts.
const SENTRY_HOST = 'o4512212070301696.ingest.de.sentry.io'

function cspDoAmbiente(mode: string): Plugin {
  return {
    name: 'csp-do-ambiente',
    apply: 'build',
    transformIndexHtml() {
      const url = loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
      let host: string
      try {
        host = url ? new URL(url).host : ''
      } catch {
        host = ''
      }
      if (!host) {
        // no Vercel o build não sai sem saber qual banco é o dele
        if (process.env.VERCEL === '1') throw new Error('VITE_SUPABASE_URL ausente ou inválida no build do Vercel')
        console.warn('[csp-do-ambiente] VITE_SUPABASE_URL ausente: build sem a CSP estreita (só a do cabeçalho)')
        return []
      }
      return [{
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: `connect-src 'self' https://${host} wss://${host} https://${SENTRY_HOST}` },
        injectTo: 'head-prepend',
      }]
    },
  }
}

export default defineConfig(({ mode }) => ({
  define: {
    __APP_VERSAO__: JSON.stringify(versaoApp()),
  },
  plugins: [react(), tailwindcss(), cspDoAmbiente(mode)],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Separa o vendor do nosso código para cache entre deploys:
        // libs de terceiros só mudam quando atualizadas (hash estável),
        // então o navegador não rebaixa React/supabase etc. a cada deploy.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          // Libs pesadas carregadas sob demanda (jspdf, pdfjs, recharts...)
          // já viram chunks próprios pelos imports dinâmicos — não mapear.
          const lazy = ['jspdf', 'pdfjs-dist', 'tesseract.js', 'html2canvas', 'mammoth', 'recharts']
          if (lazy.some((l) => id.includes(`node_modules/${l}`))) return

          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) return 'vendor-react'
          if (id.includes('node_modules/react-router')) return 'vendor-router'
          if (id.includes('node_modules/@tanstack')) return 'vendor-query'
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase'
          if (id.includes('node_modules/@base-ui')) return 'vendor-base-ui'
          if (id.includes('node_modules/cmdk')) return 'vendor-cmdk'
          if (id.includes('node_modules/lucide-react')) return 'vendor-lucide'
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion'
          if (id.includes('node_modules/react-hook-form')) return 'vendor-forms'
          if (id.includes('node_modules/zod')) return 'vendor-zod'
          if (id.includes('node_modules/@hookform')) return 'vendor-forms'
          return 'vendor-other'
        },
      },
    },
  },
}))

import path from 'path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
})

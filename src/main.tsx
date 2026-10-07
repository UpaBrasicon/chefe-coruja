import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Antes de montar o app: o retorno de recuperação de senha chega com
// #type=recovery no fragmento. Marca na sessão para o DesvioRecuperacao levar
// à troca de senha. Ficava inline no index.html; veio para cá para o CSP
// poder ser script-src 'self' (sem script inline). Roda cedo, antes do React.
try {
  if (window.location.hash.includes('type=recovery')) {
    sessionStorage.setItem('supabase_recovery', '1')
  }
} catch {
  /* sem sessionStorage: o fluxo normal de login segue */
}
import { higienizar, mensagemDe, reportarErro, versaoApp } from '@/lib/reportarErro'
import { iniciarSentry } from '@/lib/sentry'

// Sentry (item 11): sem coleta automática; só recebe o que reportarErro manda.
iniciarSentry(higienizar, versaoApp())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Painel de erros do admin (onda 12): defeitos que escapam do React.
// — Erros de JS não tratados. Erros de CARGA de recurso (img/script) chegam
//   neste mesmo evento com um elemento como alvo; esses não são defeito do app
//   e são ignorados. O 'vite:preloadError' (recarga de deploy) é tratado à
//   parte, abaixo, e não passa por aqui.
window.addEventListener('error', (event) => {
  try {
    if (event.target && event.target !== window) return // falha de recurso
    reportarErro({
      tipo: 'erro_js',
      mensagem: event.message || mensagemDe(event.error),
      detalhe: event.error instanceof Error ? (event.error.stack ?? '') : '',
    })
  } catch {
    /* reportar nunca pode gerar erro */
  }
})

// — Promessas rejeitadas sem catch.
window.addEventListener('unhandledrejection', (event) => {
  try {
    const motivo = event.reason
    reportarErro({
      tipo: 'promessa',
      mensagem: mensagemDe(motivo),
      detalhe: motivo instanceof Error ? (motivo.stack ?? '') : '',
    })
  } catch {
    /* idem */
  }
})

// Depois de um deploy, uma aba aberta pode pedir um pedaço do código (chunk)
// que não existe mais. Recarrega uma vez para pegar o index.html novo —
// sem a marca na sessão, um erro de verdade viraria laço de recarga.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('cc-recarregou-deploy')) return
    sessionStorage.setItem('cc-recarregou-deploy', '1')
  } catch {
    return
  }
  event.preventDefault()
  window.location.reload()
})

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // offline opcional — não bloqueia o app
    })
  })
}

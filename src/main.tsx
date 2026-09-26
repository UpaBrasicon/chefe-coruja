import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

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

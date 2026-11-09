// Service worker do Chefe Coruja.
//
// Troque CACHE a cada mudança deste arquivo: é o nome novo que faz o
// `activate` apagar o cache da versão anterior. Com o nome fixo, um
// navegador que usou a versão antiga guardava para sempre arquivos que não
// existem mais, e o app abria em branco depois de um deploy.
const CACHE = 'chefe-coruja-v4'

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      // na primeira carga depois de um deploy a página fala com o worker antigo:
      // o novo guarda as telas sem conexão logo que assume (sem segurar a ativação)
      .then(() => { precachear().catch(() => {}) })
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return
  const url = new URL(request.url)

  // Navegação: sempre a rede (index.html novo = nomes de arquivo novos);
  // o cache só entra sem conexão.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE).then((cache) => cache.put('/', clone))
          }
          return response
        })
        .catch(() => caches.match('/'))
    )
    return
  }

  // Só os arquivos com hash no nome (/assets/…) vão para o cache — o nome
  // muda a cada build, então o que está guardado nunca fica velho. E só se a
  // resposta for OK e não for HTML: pedir um arquivo que sumiu devolvia o
  // index.html, que era guardado no lugar do JavaScript.
  if (!url.pathname.startsWith('/assets/')) return
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached
      return fetch(request).then((response) => {
        const tipo = response.headers.get('content-type') || ''
        if (response.ok && !tipo.includes('text/html')) {
          const clone = response.clone()
          caches.open(CACHE).then((cache) => cache.put(request, clone))
        }
        return response
      })
    })
  )
})

// Recarga sem conexão, parte 2 (N5 = A, RT em 05/11/2026): a página pede, a
// cada carga, que o login, a casca e as telas da enfermagem fiquem guardados
// de antemão. A lista vem do build (precache.json); o que já está guardado não
// é baixado de novo, e um arquivo que falhar não impede os outros.
async function precachear() {
  const resposta = await fetch('/precache.json', { cache: 'no-store' })
  if (!resposta.ok) return
  const lista = await resposta.json()
  if (!Array.isArray(lista)) return
  const cache = await caches.open(CACHE)
  for (const url of lista) {
    if (typeof url !== 'string' || !url.startsWith('/assets/')) continue
    if (await cache.match(url)) continue
    try {
      const r = await fetch(url)
      const tipo = r.headers.get('content-type') || ''
      if (r.ok && !tipo.includes('text/html')) await cache.put(url, r)
    } catch {
      /* sem rede agora: tenta na próxima carga */
    }
  }
  try {
    const inicio = await fetch('/', { cache: 'no-store' })
    if (inicio.ok) await cache.put('/', inicio)
  } catch {
    /* idem */
  }
}

self.addEventListener('message', (event) => {
  if (event.data === 'precachear') event.waitUntil(precachear().catch(() => {}))
})

// Web Push: exibe a notificação quando o servidor enviar um push.
self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Chefe Coruja', body: event.data ? event.data.text() : 'Nova notificação' }
  }
  const title = payload.title || 'Chefe Coruja'
  const options = {
    body: payload.body || 'Você tem uma nova notificação.',
    // item 02 do kit de desempenho: o ícone pequeno basta para o aviso
    icon: '/logo-192.png',
    badge: '/favicon.svg',
    data: { url: payload.url || '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(clients.openWindow(url))
})

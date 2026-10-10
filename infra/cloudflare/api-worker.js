// Cloudflare Worker da API para integradores (Fase 3, tarefa 7).
//
// api.chefecoruja.com.br/v1/...       → <projeto>.supabase.co/functions/v1/api/v1/...
// api-homolog.chefecoruja.com.br/v1/… → idem, no projeto da homologação
//
// Variáveis do Worker (Settings → Variables):
//   ORIGEM         texto:  https://<ref>.supabase.co/functions/v1/api
//   BORDA_SEGREDO  segredo: o MESMO valor do segredo API_BORDA_SEGREDO da Edge Function
//
// A Edge Function só confia no CF-Connecting-IP (lista de IPs da chave) quando
// o cabeçalho X-Coruja-Borda traz esse segredo. O Worker apaga o que o cliente
// mandar nesse cabeçalho e põe o valor certo.

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ title: 'Método não permitido', status: 405, codigo: 'requisicao_invalida' }), {
        status: 405, headers: { 'Content-Type': 'application/problem+json', Allow: 'GET' },
      })
    }
    const destino = new URL(env.ORIGEM.replace(/\/+$/, '') + url.pathname + url.search)
    const cabecalhos = new Headers()
    const auth = request.headers.get('Authorization')
    if (auth) cabecalhos.set('Authorization', auth)
    cabecalhos.set('Accept', 'application/json')
    cabecalhos.set('CF-Connecting-IP', request.headers.get('CF-Connecting-IP') ?? '')
    cabecalhos.set('X-Coruja-Borda', env.BORDA_SEGREDO)
    const resposta = await fetch(destino, { method: 'GET', headers: cabecalhos })
    const saida = new Headers(resposta.headers)
    saida.set('Strict-Transport-Security', 'max-age=31536000')
    saida.delete('Set-Cookie')
    return new Response(resposta.body, { status: resposta.status, headers: saida })
  },
}

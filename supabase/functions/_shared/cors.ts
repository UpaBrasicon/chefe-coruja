// CORS das Edge Functions chamadas pelo app. O site responde em
// www.chefecoruja.com.br e em chefecoruja.com.br: com um único APP_ORIGIN, quem
// entrava pelo endereço sem www tinha a chamada bloqueada pelo navegador (o 2FA
// por e-mail e a busca com IA falhavam com mensagem genérica).
// APP_ORIGIN aceita uma lista separada por vírgula; o par www/sem-www de cada
// origem listada entra sozinho. A resposta devolve a origem da requisição
// quando ela é permitida.

function permitidas(): string[] {
  const base = (Deno.env.get('APP_ORIGIN') ?? '').split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean)
  const lista = new Set<string>()
  for (const o of base) {
    lista.add(o)
    try {
      const u = new URL(o)
      const par = u.hostname.startsWith('www.') ? u.hostname.slice(4) : 'www.' + u.hostname
      lista.add(`${u.protocol}//${par}${u.port ? ':' + u.port : ''}`)
    } catch { /* origem malformada: ignora */ }
  }
  return [...lista]
}

/** Origem a devolver em Access-Control-Allow-Origin para esta requisição. */
export function origemPermitida(req: Request): string {
  const lista = permitidas()
  if (lista.length === 0) return '*'
  const origem = req.headers.get('Origin') ?? ''
  return lista.includes(origem) ? origem : lista[0]
}

/** Aplica a origem certa (e Vary: Origin) na resposta pronta. */
export function comCors(req: Request, r: Response): Response {
  r.headers.set('Access-Control-Allow-Origin', origemPermitida(req))
  r.headers.append('Vary', 'Origin')
  return r
}

// Sentry nas Edge Functions (Fase 0, item 11 do BACKLOG.md), sem SDK: um POST
// de "envelope" para o mesmo projeto do frontend (região UE).
//
// LGPD: vai só o nome da função, o ponto do código e a mensagem HIGIENIZADA
// (e-mail, CPF/CNS, ids e números longos trocados por marcadores). Nunca corpo
// de requisição, pergunta clínica, resposta do banco ou dado de paciente.
// Relatar nunca derruba a função: tudo em try/catch, sem esperar a resposta.

const DSN_PADRAO = 'https://c4ff5eec6cc7d1cf63df712d20dcf9ae@o4512212070301696.ingest.de.sentry.io/4512212075741264'

export function higienizar(texto: string): string {
  return (texto ?? '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '<email>')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\d{3}\.\d{3}\.\d{3}-\d{2}/g, '<doc>')
    .replace(/\d{11,}/g, '<doc>')
    .replace(/\d{5,}/g, '<n>')
    .slice(0, 300)
}

function ambiente(): string {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  if (url.includes('saqjrjtrkzkswsxxvdxn')) return 'producao'
  if (url.includes('kswurfyxxvfydpjfrivy')) return 'homolog'
  return 'local'
}

/** Relata um defeito da função ao Sentry (dispare e esqueça). */
export function relatarErro(funcao: string, ponto: string, erro: unknown): void {
  try {
    const amb = ambiente()
    const dsn = Deno.env.get('SENTRY_DSN') || (amb === 'local' ? '' : DSN_PADRAO)
    if (!dsn) return
    const u = new URL(dsn)
    const projeto = u.pathname.replace(/\//g, '')
    const mensagem = higienizar(`${funcao}/${ponto}: ${erro instanceof Error ? erro.message : String(erro)}`)
    const evento = {
      event_id: crypto.randomUUID().replace(/-/g, ''),
      timestamp: Date.now() / 1000,
      platform: 'javascript',
      level: 'error',
      environment: amb,
      message: { formatted: mensagem },
      tags: { tipo: 'edge_function', funcao, ponto, area: funcao === 'enviar-codigo-2fa' ? 'autenticacao' : 'edge' },
      fingerprint: [funcao, ponto],
    }
    const envelope = [
      JSON.stringify({ event_id: evento.event_id, sent_at: new Date().toISOString(), dsn }),
      JSON.stringify({ type: 'event' }),
      JSON.stringify(evento),
    ].join('\n')
    const envio = fetch(`${u.protocol}//${u.host}/api/${projeto}/envelope/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-sentry-envelope',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_key=${u.username}, sentry_client=chefe-coruja-edge/1.0`,
      },
      body: envelope,
    }).catch(() => undefined)
    // a função pode responder antes do envio terminar: o runtime da Supabase espera por ele
    ;(globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime?.waitUntil?.(envio)
  } catch {
    /* relatar nunca derruba a função */
  }
}

/** Envolve o handler: exceção não tratada vira relato + 500 genérico (sem detalhe ao cliente). */
export function comRelato(funcao: string, handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    try {
      return await handler(req)
    } catch (e) {
      relatarErro(funcao, 'nao_tratado', e)
      return new Response(JSON.stringify({ erro: 'erro interno' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }
}

import * as Sentry from '@sentry/react'

/**
 * Sentry (Fase 0, item 11 do BACKLOG.md — observabilidade mínima).
 *
 * Desenho LGPD: o Sentry NÃO coleta nada sozinho. Sem integrações padrão — nada
 * de breadcrumbs (cliques, texto de tela, console, URLs de fetch), nada de
 * captura global própria, nada de dado do usuário. O único caminho até o Sentry
 * é `enviarAoSentry`, chamado por `reportarErro` DEPOIS da higienização e dos
 * filtros de regra/ruído de lá. O `beforeSend` ainda limpa de novo, por garantia.
 *
 * No ambiente local (banco local) fica inerte, a não ser com VITE_SENTRY_DSN.
 */

export type ContextoErro = { unidadeId?: string | null; papel?: string | null }

let ligado = false
let contexto: ContextoErro = {}

/** Ambiente pelo projeto Supabase do build (o mesmo que separa produção e homologação). */
export function ambienteDoBuild(url = import.meta.env.VITE_SUPABASE_URL ?? ''): 'producao' | 'homolog' | 'local' {
  if (url.includes('saqjrjtrkzkswsxxvdxn')) return 'producao'
  if (url.includes('kswurfyxxvfydpjfrivy')) return 'homolog'
  return 'local'
}

/** Limpeza final de qualquer evento (defesa em profundidade). */
export function limparEvento<E extends Sentry.ErrorEvent>(evento: E, higienizar: (t: string) => string): E {
  delete evento.request
  delete evento.user
  delete evento.breadcrumbs
  delete evento.server_name
  evento.contexts = {}
  if (evento.message) evento.message = higienizar(evento.message)
  for (const ex of evento.exception?.values ?? []) {
    if (ex.value) ex.value = higienizar(ex.value)
  }
  if (evento.extra) {
    evento.extra = Object.fromEntries(
      Object.entries(evento.extra).map(([k, v]) => [k, typeof v === 'string' ? higienizar(v) : '[removido]'])
    )
  }
  return evento
}

// DSN do projeto chefe-coruja (região UE). Não é segredo: vai embutido no site.
// O host também está na CSP (vercel.json e vite.config.ts).
const DSN_PADRAO = 'https://c4ff5eec6cc7d1cf63df712d20dcf9ae@o4512212070301696.ingest.de.sentry.io/4512212075741264'

export function iniciarSentry(higienizar: (t: string) => string, versao: string): void {
  // no computador de desenvolvimento só liga com VITE_SENTRY_DSN explícito
  const dsn = import.meta.env.VITE_SENTRY_DSN || (ambienteDoBuild() === 'local' ? '' : DSN_PADRAO)
  if (!dsn || ligado) return
  try {
    Sentry.init({
      dsn,
      environment: ambienteDoBuild(),
      release: versao || undefined,
      defaultIntegrations: false,
      integrations: [],
      sendDefaultPii: false,
      maxBreadcrumbs: 0,
      beforeSend: (evento) => limparEvento(evento, higienizar),
    })
    ligado = true
  } catch {
    /* observabilidade nunca derruba o app */
  }
}

/** Unidade e papel ativos (nunca nome de paciente ou de profissional). */
export function definirContextoErro(novo: ContextoErro): void {
  contexto = novo
}

/** Área do sistema pela origem/mensagem — o motor de prescrição tem prioridade. */
export function areaDe(origem: string, mensagem: string): string {
  const t = `${origem} ${mensagem}`.toLowerCase()
  if (/prescri|aprazar|checar|validar_item|suspender_item|dilui/.test(t)) return 'prescricao'
  if (/auth|login|token|segundo_fator|2fa|senha/.test(t)) return 'autenticacao'
  if (/rpc\//.test(t)) return 'rpc'
  return 'app'
}

export function enviarAoSentry(e: {
  tipo: string
  mensagem: string
  detalhe: string
  origem: string
  assinatura: string
  requestId?: string
}): void {
  if (!ligado) return
  try {
    Sentry.withScope((escopo) => {
      escopo.setTags({
        tipo: e.tipo,
        origem: e.origem || '/',
        area: areaDe(e.origem, e.mensagem),
        unidade: contexto.unidadeId ?? '—',
        papel: contexto.papel ?? '—',
        ...(e.requestId ? { request_id: e.requestId } : {}),
      })
      escopo.setFingerprint([e.assinatura])
      if (e.detalhe) escopo.setExtra('detalhe', e.detalhe)
      Sentry.captureMessage(e.mensagem, 'error')
    })
  } catch {
    /* idem */
  }
}

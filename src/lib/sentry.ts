import type * as SentryTipos from '@sentry/react'

import { criarFilaAteCarregar } from '@/lib/filaAteCarregar'
import { montarMetrica, type MetricaEnviada } from '@/lib/metricaReal'

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
 *
 * Item 21 do kit de desempenho: a biblioteca (cerca de 31 KB em gzip) não vai
 * mais no pacote inicial. Desce depois que a página carregou e ficou ociosa;
 * o que for reportado antes espera numa fila de até 20 erros. O registro no
 * banco (registrar_erro_cliente, em reportarErro) continua na hora.
 */

type Sentry = typeof import('@/lib/sentryCarga')

export type ContextoErro = { unidadeId?: string | null; papel?: string | null }

type EventoErro = {
  tipo: string
  mensagem: string
  detalhe: string
  origem: string
  assinatura: string
  requestId?: string
}

let ligado = false
let contexto: ContextoErro = {}

const fila = criarFilaAteCarregar<Sentry, EventoErro>({ maximo: 20 }, (Sentry, e) => {
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
})

/** Roda depois que a página carregou e o navegador ficou ocioso. */
function depoisDaPintura(fn: () => void): void {
  const ocioso = () => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    if (ric) ric(fn, { timeout: 5000 })
    else setTimeout(fn, 1500)
  }
  if (document.readyState === 'complete') ocioso()
  else window.addEventListener('load', ocioso, { once: true })
}

/** Ambiente pelo projeto Supabase do build (o mesmo que separa produção e homologação). */
export function ambienteDoBuild(url = import.meta.env.VITE_SUPABASE_URL ?? ''): 'producao' | 'homolog' | 'local' {
  if (url.includes('saqjrjtrkzkswsxxvdxn')) return 'producao'
  if (url.includes('kswurfyxxvfydpjfrivy')) return 'homolog'
  return 'local'
}

/** Limpeza final de qualquer evento (defesa em profundidade). */
export function limparEvento<E extends SentryTipos.ErrorEvent>(evento: E, higienizar: (t: string) => string): E {
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
  ligado = true
  depoisDaPintura(() => {
    import('@/lib/sentryCarga').then(
      (Sentry) => {
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
          fila.pronto(Sentry)
          filaMetricas.pronto(Sentry)
          iniciarMetricasReais()
        } catch {
          /* observabilidade nunca derruba o app */
        }
      },
      () => {
        /* sem rede para baixar a biblioteca: o erro já foi ao banco */
      },
    )
  })
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

export function enviarAoSentry(e: EventoErro): void {
  if (!ligado) return
  fila.enviar(e)
}

// ── Item 30 do kit de desempenho: métricas de usuários reais ────────────────
// Decisão do RT em 09/11/2026. LCP, INP, CLS, FCP e TTFB (web-vitals) de cada
// abertura de tela vão ao Sentry como mensagem de nível "info". Só cinco
// marcadores: métrica, valor, nota, rota sem identificador e papel ativo
// (montarMetrica). Unidade, nome, CPF, CNS e texto de tela não vão.
// TAXA_METRICAS: fração das aberturas medidas; com pouco uso, todas. Baixar
// quando o volume crescer (cota do Sentry).
const TAXA_METRICAS = 1

const filaMetricas = criarFilaAteCarregar<Sentry, MetricaEnviada>({ maximo: 20 }, (Sentry, m) => {
  Sentry.withScope((escopo) => {
    escopo.setTags({ tipo: 'metrica', metrica: m.metrica, valor: m.valor, nota: m.nota, rota: m.rota, papel: m.papel })
    escopo.setFingerprint(['metrica', m.metrica, m.rota])
    Sentry.captureMessage(`metrica ${m.metrica}`, 'info')
  })
})

export function enviarMetricaAoSentry(m: { name: string; value: number; rating: string }, caminho: string): void {
  if (!ligado) return
  filaMetricas.enviar(montarMetrica(m, caminho, contexto.papel))
}

function iniciarMetricasReais(): void {
  if (Math.random() >= TAXA_METRICAS) return
  import('web-vitals').then(
    ({ onCLS, onFCP, onINP, onLCP, onTTFB }) => {
      const enviar = (m: { name: string; value: number; rating: string }) => {
        try {
          enviarMetricaAoSentry(m, window.location.pathname)
        } catch {
          /* medição nunca derruba o app */
        }
      }
      onLCP(enviar)
      onINP(enviar)
      onCLS(enviar)
      onFCP(enviar)
      onTTFB(enviar)
    },
    () => {
      /* sem rede para baixar a biblioteca: fica sem a medição desta abertura */
    },
  )
}

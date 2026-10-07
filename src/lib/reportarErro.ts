import { supabase } from '@/lib/supabase'

/**
 * Captura de erros do cliente (onda 12 — "Erros e alertas do sistema").
 *
 * O objetivo é dar ao administrador geral um painel com os defeitos de verdade
 * do app (tela quebrada, TypeError, 500, falha de rede inesperada), sem jamais
 * vazar dado de paciente nem transformar uma recusa esperada do servidor
 * (acesso negado, convite, segundo fator) em "erro".
 *
 * Regras de ouro deste arquivo:
 *  - Higienização (LGPD): nada de conteúdo digitado nem identificadores. A
 *    mensagem e o detalhe passam por `higienizar`, e a origem é o template da
 *    rota (sem query string, sem id no caminho).
 *  - Reportar erro JAMAIS pode gerar outro erro visível: tudo em try/catch e o
 *    envio é "dispare e esqueça".
 */

export type TipoErro = 'render' | 'erro_js' | 'promessa' | 'rpc' | 'rede'

export interface EntradaErro {
  tipo: TipoErro
  mensagem: string
  /** Pilha/contexto adicional. Também é higienizado e truncado. */
  detalhe?: string
  /** Rota de origem; se faltar, deriva de `window.location`. */
  origem?: string
}

const LIMITE_MENSAGEM = 300
const LIMITE_DETALHE = 1500
/** Mesma assinatura não é reenviada antes disso (anti-flood no cliente). */
const JANELA_ANTIFLOOD_MS = 60_000

// ── Higienização ───────────────────────────────────────────────────────────

// A ordem importa: e-mail antes dos números (o e-mail pode conter dígitos),
// UUID antes de "doc", e "doc" (11+ dígitos) antes de "número longo".
const RE_EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const RE_UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
const RE_DOC_FORMATADO = /\d{3}\.\d{3}\.\d{3}-\d{2}/g // CPF com pontuação
const RE_DOC = /\d{11,}/g // CPF/CNS e outras sequências de 11+ dígitos
const RE_NUMERO_LONGO = /\d{5,}/g // demais números longos

/** Troca identificadores por marcadores. Nunca envia dado de paciente. */
export function higienizar(texto: string): string {
  if (!texto) return ''
  return texto
    .replace(RE_EMAIL, '<email>')
    .replace(RE_UUID, '<id>')
    .replace(RE_DOC_FORMATADO, '<doc>')
    .replace(RE_DOC, '<doc>')
    .replace(RE_NUMERO_LONGO, '<n>')
}

function truncar(texto: string, limite: number): string {
  return texto.length > limite ? texto.slice(0, limite) : texto
}

// ── Origem (template da rota, sem query nem id) ──────────────────────────────

/**
 * Converte um pathname no template da rota: sem query string e com os
 * parâmetros do caminho (ids, tokens) trocados por `:id`. Ex.:
 * `/prontuarios/9b1c...` → `/prontuarios/:id`.
 */
export function templateRota(pathname: string): string {
  const limpo = (pathname.split('?')[0].split('#')[0] || '/').replace(/\/+$/, '')
  if (!limpo) return '/'
  const partes = limpo.split('/').map((seg) => {
    if (!seg) return seg
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) return ':id'
    if (/^\d+$/.test(seg)) return ':id'
    if (/^[A-Za-z0-9_-]{20,}$/.test(seg)) return ':id' // token (link público etc.)
    if (seg.length >= 12 && /\d/.test(seg)) return ':id'
    return seg
  })
  return partes.join('/') || '/'
}

function origemAtual(): string {
  try {
    return templateRota(window.location.pathname)
  } catch {
    return ''
  }
}

// ── Defeito x regra de negócio ───────────────────────────────────────────────

/**
 * Mensagens que são recusa ESPERADA do servidor (RAISE de regra, RLS, Auth) —
 * não são defeito e não devem ir ao painel. Na dúvida de rede, o chamador marca
 * tipo 'rede' e isto não bloqueia.
 */
const PADROES_REGRA: RegExp[] = [
  /acesso negado/i,
  /permiss[aã]o negada/i,
  /permission denied/i,
  /n[aã]o autorizad/i,
  /\b42501\b/, // PostgREST: insufficient_privilege
  /row-level security/i,
  /violat(?:es|ion).*(?:policy|security)/i,
  /conta nova s[óo] com convite/i,
  /convite (?:inv[aá]lido|expirado|j[aá] usado|obrigat[óo]rio)/i,
  /segundo fator/i,
  /c[óo]digo (?:inv[aá]lido|expirado|incorreto)/i,
  /sess[aã]o expirad/i,
  /jwt (?:expired|invalid)/i,
  /email not confirmed/i,
  /invalid login credentials/i,
  /fora do (?:hor[áa]rio|plant[aã]o)/i,
  /sem plant[aã]o/i,
  /not authenticated/i,
  /refresh token/i,
]

/** Ruído de navegador / recarga de deploy que não é defeito do app. */
const PADROES_RUIDO: RegExp[] = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i,
  /^Load failed$/i, // recurso cancelado (navegação/offline)
  /Non-Error promise rejection/i,
  // Chunk antigo some depois de um deploy — é o caso do 'vite:preloadError',
  // tratado com recarga única em main.tsx; não é defeito.
  /Failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /Importing a module script failed/i,
  /dynamically imported module/i,
]

function devoIgnorar(mensagem: string): boolean {
  if (!mensagem) return true
  return PADROES_RUIDO.some((r) => r.test(mensagem)) || PADROES_REGRA.some((r) => r.test(mensagem))
}

// ── Assinatura (rótulo estável para agrupar) ─────────────────────────────────

/** Hash curto e estável (djb2) em base36 — não precisa de lib. */
function hashCurto(texto: string): string {
  let h = 5381
  for (let i = 0; i < texto.length; i++) {
    h = (h * 33) ^ texto.charCodeAt(i)
  }
  return (h >>> 0).toString(36)
}

function assinaturaDe(tipo: string, origem: string, mensagem: string): string {
  const primeiraLinha = mensagem.split('\n')[0].trim()
  return hashCurto(`${tipo}|${origem}|${primeiraLinha}`)
}

// ── Anti-flood ───────────────────────────────────────────────────────────────

const vistasEmMemoria = new Map<string, number>()

function recenteDemais(assinatura: string): boolean {
  const agora = Date.now()
  const chave = `cc-erro-${assinatura}`

  let anterior = vistasEmMemoria.get(assinatura) ?? 0
  if (!anterior) {
    try {
      anterior = Number(sessionStorage.getItem(chave) ?? 0)
    } catch {
      /* sem sessionStorage: só a memória conta */
    }
  }
  if (anterior && agora - anterior < JANELA_ANTIFLOOD_MS) return true

  vistasEmMemoria.set(assinatura, agora)
  try {
    sessionStorage.setItem(chave, String(agora))
  } catch {
    /* idem */
  }
  return false
}

// ── Metadados do ambiente ────────────────────────────────────────────────────

function navegador(): string {
  try {
    return truncar(navigator.userAgent ?? '', 300)
  } catch {
    return ''
  }
}

function versaoApp(): string {
  try {
    // Injetado pelo Vite (ver vite.config.ts). Sem build, '' — e fica como
    // pendência conhecida até existir VITE_COMMIT no deploy.
    return typeof __APP_VERSAO__ === 'string' ? __APP_VERSAO__ : ''
  } catch {
    return ''
  }
}

// ── Envio ────────────────────────────────────────────────────────────────────

/**
 * Monta e envia um erro ao banco via RPC `registrar_erro_cliente`. É "dispare e
 * esqueça": falha de envio (RPC ausente, offline) é engolida de propósito.
 */
export function reportarErro(entrada: EntradaErro): void {
  try {
    const mensagemCrua = entrada.mensagem ?? ''
    if (devoIgnorar(mensagemCrua)) return

    const origem = entrada.origem ?? origemAtual()
    const mensagem = truncar(higienizar(mensagemCrua), LIMITE_MENSAGEM)
    if (!mensagem) return
    const detalhe = truncar(higienizar(entrada.detalhe ?? ''), LIMITE_DETALHE)
    const assinatura = assinaturaDe(entrada.tipo, origem, mensagem)

    if (recenteDemais(assinatura)) return

    // `Promise.resolve` transforma o builder (thenable) numa Promise de verdade
    // com `.catch` — nunca propagar: reportar não pode gerar erro.
    void Promise.resolve(
      supabase.rpc('registrar_erro_cliente', {
        p_tipo: entrada.tipo,
        p_origem: origem,
        p_mensagem: mensagem,
        p_detalhe: detalhe,
        p_assinatura: assinatura,
        p_navegador: navegador(),
        p_versao_app: versaoApp(),
      })
    ).catch(() => undefined)
  } catch {
    /* reportar erro JAMAIS pode gerar outro erro visível */
  }
}

/** `message` de um valor desconhecido (o que o `catch`/evento entrega). */
export function mensagemDe(valor: unknown): string {
  if (valor instanceof Error) return valor.message || valor.name
  if (typeof valor === 'string') return valor
  try {
    return String(valor)
  } catch {
    return ''
  }
}

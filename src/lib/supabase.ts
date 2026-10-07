import { createClient, type SupportedStorage } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { mensagemDe, reportarErro } from '@/lib/reportarErro'
import { ehDefeitoDoBanco } from '@/lib/defeitoBanco'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.')
}

// "Manter conectado neste aparelho" (login): marcado, a sessão fica no
// localStorage e sobrevive ao fechar o navegador — por até 12 horas, um
// plantão; desmarcado (o padrão), fica no sessionStorage e morre com a aba, o
// certo para o computador do posto, onde outra pessoa senta logo depois.
//
// Decisão do usuário (29/09/2026): a sessão acaba ao fechar a aba. Sem escolha
// registrada vale a aba — e o token antigo que ficou no localStorage de antes
// desta regra é apagado na carga (quem estava logado entra de novo uma vez).
const CHAVE_MANTER = 'cc-manter-conectado'
const CHAVE_DESDE = 'cc-manter-desde'
/** Quanto "manter conectado" segura a sessão depois do login. */
export const MANTER_MAX_MS = 12 * 60 * 60 * 1000

function ler(area: Storage | undefined, chave: string): string | null {
  try {
    return area?.getItem(chave) ?? null
  } catch {
    return null
  }
}
function gravar(area: Storage | undefined, chave: string, valor: string) {
  try {
    area?.setItem(chave, valor)
  } catch {
    /* modo privado ou cota: a sessão só não persiste */
  }
}
function apagar(area: Storage | undefined, chave: string) {
  try {
    area?.removeItem(chave)
  } catch {
    /* idem */
  }
}

function area(qual: 'localStorage' | 'sessionStorage'): Storage | undefined {
  try {
    return typeof window !== 'undefined' ? window[qual] : undefined
  } catch {
    return undefined // armazenamento bloqueado pelo navegador
  }
}
const local = area('localStorage')
const sessao = area('sessionStorage')

/** A sessão deve sobreviver ao fechar o navegador? (sem escolha: não) */
export function manterConectado(): boolean {
  return ler(local, CHAVE_MANTER) === '1'
}

/** "Manter conectado" passou das 12 horas: a sessão tem de acabar. */
export function manterConectadoVencido(): boolean {
  if (!manterConectado()) return false
  const desde = Number(ler(local, CHAVE_DESDE) ?? 0)
  return !desde || Date.now() - desde > MANTER_MAX_MS
}

// Token de antes da regra (ou de quem desmarcou): nada de sessão esquecida no
// localStorage de um computador compartilhado.
function purgarLocal() {
  const chaves: string[] = []
  try {
    for (let i = 0; i < (local?.length ?? 0); i++) {
      const k = local!.key(i)
      if (k && k.startsWith('sb-')) chaves.push(k)
    }
  } catch {
    return
  }
  for (const k of chaves) apagar(local, k)
}
if (!manterConectado()) purgarLocal()

/** A pessoa marcou "Manter conectado" da última vez? (a caixa nasce desmarcada) */
export function manterConectadoMarcado(): boolean {
  return ler(local, CHAVE_MANTER) === '1'
}

/**
 * Registra a escolha ANTES do login. A sessão que existir é movida para o
 * lugar novo, e o lugar antigo é limpo: desmarcar nunca deixa token para trás
 * no localStorage.
 */
export function definirManterConectado(manter: boolean) {
  const origem = manterConectado() ? local : sessao
  const destino = manter ? local : sessao
  gravar(local, CHAVE_MANTER, manter ? '1' : '0')
  if (manter) gravar(local, CHAVE_DESDE, String(Date.now()))
  else apagar(local, CHAVE_DESDE)
  if (origem === destino || !origem) return
  const chaves: string[] = []
  try {
    for (let i = 0; i < origem.length; i++) {
      const k = origem.key(i)
      if (k && k.startsWith('sb-')) chaves.push(k)
    }
  } catch {
    return
  }
  for (const k of chaves) {
    const v = ler(origem, k)
    if (v !== null) gravar(destino, k, v)
    apagar(origem, k)
  }
}

// Lê e grava só no lugar escolhido; apagar limpa os dois (sair nunca deixa
// sessão esquecida no outro).
const armazenamento: SupportedStorage = {
  getItem: (chave) => ler(manterConectado() ? local : sessao, chave),
  setItem: (chave, valor) => {
    const manter = manterConectado()
    gravar(manter ? local : sessao, chave, valor)
    apagar(manter ? sessao : local, chave)
  },
  removeItem: (chave) => {
    apagar(local, chave)
    apagar(sessao, chave)
  },
}

// Caminho da API sem query string (a query pode conter ids/filtros com dado de
// paciente — por isso usamos só o pathname) para rotular o erro.
function caminhoApi(url: string): string {
  try {
    const u = new URL(url)
    return u.pathname.replace(/^\/rest\/v1\//, '').replace(/^\/auth\/v1\//, 'auth/')
  } catch {
    return ''
  }
}

function urlDaRequisicao(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

/**
 * Envolve o `fetch` do cliente central só para RELATAR defeito, sem mudar o
 * comportamento das telas: a resposta e os erros seguem intactos.
 *
 * O que vira relato (onda 12; item 11 da Fase 0):
 *  - status 500+ → tipo 'rpc' (defeito do servidor);
 *  - 4xx da API do banco cujo CÓDIGO indica defeito (erro interno de função,
 *    coluna/função inexistente, deadlock — ver `defeitoBanco.ts`). Recusa de
 *    regra (RAISE das RPCs, permissão, JWT) continua fora. Vai só o código e a
 *    rota, nunca a mensagem do banco (pode trazer dado digitado).
 *  - falha de rede (o fetch rejeita) → tipo 'rede'.
 * O próprio envio do relato (RPC `registrar_erro_cliente`) é ignorado para não
 * criar laço quando o banco/rede estiver fora.
 */
function fetchComRelato(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = urlDaRequisicao(input)
  const ehRelato = url.includes('registrar_erro_cliente')
  return fetch(input, init).then(
    (resp) => {
      if (!ehRelato && resp.status >= 400) {
        const requestId = resp.headers.get('sb-request-id') ?? resp.headers.get('x-request-id') ?? undefined
        if (resp.status >= 500) {
          reportarErro({ tipo: 'rpc', mensagem: `HTTP ${resp.status} ${caminhoApi(url)}`.trim(), requestId })
        } else if (url.includes('/rest/v1/')) {
          // lê uma cópia do corpo só pelo código; a tela recebe a resposta intacta
          void resp.clone().json().then(
            (corpo: { code?: string } | null) => {
              const codigo = corpo?.code ?? null
              if (ehDefeitoDoBanco(resp.status, codigo)) {
                reportarErro({ tipo: 'rpc', mensagem: `PG ${codigo} HTTP ${resp.status} ${caminhoApi(url)}`.trim(), requestId })
              }
            },
            () => undefined,
          )
        }
      }
      return resp
    },
    (erro: unknown) => {
      // Na dúvida de rede, marque 'rede' (recusa de regra nunca cai aqui — ela
      // volta como resposta 4xx, não como rejeição do fetch).
      if (!ehRelato) {
        reportarErro({
          tipo: 'rede',
          mensagem: `${mensagemDe(erro)} ${caminhoApi(url)}`.trim(),
        })
      }
      throw erro
    }
  )
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: { storage: armazenamento },
  global: { fetch: fetchComRelato },
})

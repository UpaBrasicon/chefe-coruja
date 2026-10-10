// Regras puras da API para integradores (Fase 3, tarefa 7): rota → recurso,
// conferência dos parâmetros e formato dos erros (RFC 9457). Sem Deno nem
// rede, para testar no Node (contrato.test.ts). O contrato é
// docs/api/openapi.yaml; o banco confere chave, escopo e limite em api_v1.

export type Recurso = 'unidades' | 'paciente_busca' | 'paciente' | 'atendimentos' | 'atendimento'
  | 'leitos' | 'aih' | 'apac' | 'fechamentos'

export type CodigoErro = 'requisicao_invalida' | 'chave_invalida' | 'fora_do_escopo' | 'nao_encontrado'
  | 'limite_excedido' | 'erro_interno' | 'indisponivel'

const TITULO: Record<CodigoErro, string> = {
  requisicao_invalida: 'Requisição inválida',
  chave_invalida: 'Chave inválida',
  fora_do_escopo: 'Fora do escopo da chave',
  nao_encontrado: 'Não encontrado',
  limite_excedido: 'Limite de consultas excedido',
  erro_interno: 'Erro interno',
  indisponivel: 'Indisponível',
}

export type Problema = {
  type: string; title: string; status: number; detail?: string; codigo: CodigoErro; requisicao: string
}

export function problema(status: number, codigo: CodigoErro, detalhe: string | undefined, requisicao: string): Problema {
  return {
    type: `https://api.chefecoruja.com.br/erros/${codigo.replace(/_/g, '-')}`,
    title: TITULO[codigo] ?? 'Erro',
    status,
    ...(detalhe ? { detail: detalhe } : {}),
    codigo,
    requisicao,
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COMPETENCIA = /^[0-9]{4}(0[1-9]|1[0-2])$/
const SITUACOES = ['aguardando_triagem', 'aguardando_medico', 'em_atendimento', 'em_observacao', 'encerrado']
const STATUS_LEITO = ['livre', 'ocupado', 'bloqueado', 'higienizacao', 'reservado']
const STATUS_AIH = ['solicitada', 'aprovada', 'rejeitada', 'cancelada']
const STATUS_APAC = ['solicitada', 'autorizada', 'rejeitada', 'cancelada']

/** Caminho sem o prefixo da função (/api) e sem a versão (/v1). */
export function caminhoDaApi(pathname: string): string {
  let p = pathname.replace(/\/+$/, '')
  const i = p.indexOf('/api/')
  if (p.endsWith('/api')) p = ''
  else if (i >= 0) p = p.slice(i + 4)
  if (p.startsWith('/v1/') || p === '/v1') p = p.slice(3)
  return p || '/'
}

type Pedido = { recurso: Recurso; params: Record<string, string | number> }
type Recusa = { erro: { status: number; codigo: CodigoErro; detalhe: string } }

const invalido = (detalhe: string): Recusa => ({ erro: { status: 400, codigo: 'requisicao_invalida', detalhe } })

/** Rota + query → recurso e parâmetros conferidos, ou o erro do contrato. */
export function interpretar(caminho: string, query: URLSearchParams): Pedido | Recusa {
  const p: Record<string, string | number> = {}
  const pega = (nome: string, regra?: (v: string) => boolean, msg?: string): Recusa | null => {
    const v = query.get(nome)
    if (v === null || v === '') return null
    if (regra && !regra(v)) return invalido(msg ?? `Parâmetro ${nome} fora do formato.`)
    p[nome] = v
    return null
  }
  const paginacao = (): Recusa | null => {
    const l = query.get('limite')
    if (l !== null && l !== '') {
      const n = Number(l)
      if (!Number.isInteger(n) || n < 1 || n > 100) return invalido('limite vai de 1 a 100.')
      p.limite = n
    }
    return pega('cursor')
  }
  const unidade = (): Recusa | null => {
    const v = query.get('unidade_id')
    if (!v) return invalido('Informe unidade_id.')
    if (!UUID.test(v)) return invalido('unidade_id não é um UUID.')
    p.unidade_id = v
    return null
  }
  const umDe = (lista: string[]) => (v: string) => lista.includes(v)
  const dataHora = (v: string) => !Number.isNaN(Date.parse(v)) && /\d{4}-\d{2}-\d{2}T/.test(v)

  const seg = caminho.split('/').filter(Boolean)
  let recurso: Recurso | null = null
  let erro: Recusa | null = null

  if (seg.length === 1 && seg[0] === 'unidades') {
    recurso = 'unidades'
  } else if (seg[0] === 'pacientes' && seg.length === 1) {
    recurso = 'paciente_busca'
    erro = unidade() ?? pega('cns', (v) => /^[0-9]{15}$/.test(v), 'cns com 15 dígitos.') ?? pega('cpf', (v) => /^[0-9]{11}$/.test(v), 'cpf com 11 dígitos.')
    if (!erro && (('cns' in p) === ('cpf' in p))) erro = invalido('Informe cns ou cpf (um dos dois).')
  } else if (seg[0] === 'pacientes' && seg.length === 2) {
    recurso = 'paciente'
    if (!UUID.test(seg[1])) return { erro: { status: 404, codigo: 'nao_encontrado', detalhe: 'Não encontrado.' } }
    p.id = seg[1]
  } else if (seg[0] === 'atendimentos' && seg.length === 1) {
    recurso = 'atendimentos'
    erro = unidade() ?? pega('desde', dataHora, 'desde em ISO 8601 (ex.: 2026-10-01T00:00:00-03:00).')
      ?? pega('ate', dataHora, 'ate em ISO 8601.') ?? pega('situacao', umDe(SITUACOES), 'situacao fora da lista.')
      ?? pega('paciente_id', (v) => UUID.test(v), 'paciente_id não é um UUID.') ?? paginacao()
    if (!erro && (!('desde' in p) || !('ate' in p))) erro = invalido('Informe desde e ate.')
  } else if (seg[0] === 'atendimentos' && seg.length === 2) {
    recurso = 'atendimento'
    if (!UUID.test(seg[1])) return { erro: { status: 404, codigo: 'nao_encontrado', detalhe: 'Não encontrado.' } }
    p.id = seg[1]
  } else if (seg.length === 1 && seg[0] === 'leitos') {
    recurso = 'leitos'
    erro = unidade() ?? pega('status', umDe(STATUS_LEITO), 'status de leito fora da lista.') ?? paginacao()
  } else if (seg[0] === 'producao' && seg.length === 2 && seg[1] === 'aih') {
    recurso = 'aih'
    erro = unidade() ?? pega('status', umDe(STATUS_AIH), 'status de AIH fora da lista.')
      ?? pega('competencia', (v) => COMPETENCIA.test(v), 'competencia no formato AAAAMM.') ?? paginacao()
  } else if (seg[0] === 'producao' && seg.length === 2 && seg[1] === 'apac') {
    recurso = 'apac'
    erro = unidade() ?? pega('status', umDe(STATUS_APAC), 'status de APAC fora da lista.') ?? paginacao()
  } else if (seg[0] === 'producao' && seg.length === 2 && seg[1] === 'fechamentos') {
    recurso = 'fechamentos'
    erro = unidade() ?? pega('instrumento', umDe(['bpa', 'apac']), 'instrumento: bpa ou apac.')
      ?? pega('competencia', (v) => COMPETENCIA.test(v), 'competencia no formato AAAAMM.')
  }
  if (!recurso) return { erro: { status: 404, codigo: 'nao_encontrado', detalhe: 'Recurso inexistente.' } }
  if (erro) return erro
  return { recurso, params: p }
}

/** Chave do cabeçalho Authorization: Bearer <chave>. */
export function chaveDoCabecalho(auth: string | null): string | null {
  const m = /^Bearer\s+(cc_(live|test)_[0-9a-f]{48})\s*$/.exec(auth ?? '')
  return m ? m[1] : null
}

/**
 * IP de origem. Atrás do Cloudflare, vale o CF-Connecting-IP só quando a
 * borda prova que é ela (cabeçalho X-Coruja-Borda com o segredo
 * compartilhado). Sem isso, vale o primeiro IP do X-Forwarded-For.
 */
export function ipDeOrigem(cab: (n: string) => string | null, segredoBorda: string | undefined): string | null {
  if (segredoBorda && cab('x-coruja-borda') === segredoBorda && cab('cf-connecting-ip')) return cab('cf-connecting-ip')
  const xff = cab('x-forwarded-for')
  return xff ? xff.split(',')[0].trim() || null : null
}

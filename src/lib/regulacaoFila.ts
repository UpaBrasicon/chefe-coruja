// Fila do médico regulador no modelo do RT (25/11/2026, RG1, RG3, RG6 e os
// indicadores da fila). Lógica pura, sem tela: filtros, atalhos com contagem,
// ordenação, agrupamento, horas sem evolução (pelos prazos reais da central,
// que chegam no SLA de cada pedido), compatibilidade e ordem das vagas, demanda
// por município e as tabelas dos indicadores. Os números vêm do banco; nada
// aqui inventa valor.

import { ISOLAMENTOS, PRIORIDADES, SITUACOES_ISOLAMENTO, TIPOS_LEITO, prioridadeEfetiva, type Prioridade, type SituacaoIsolamento, type Sla, type StatusRegulacao, type Vulnerabilidade } from './regulacao.ts'
import { textoIsolamento } from './isolamentoPedido.ts'
import { tempoSemEvolucao } from './tempoSemEvolucao.ts'

/** O que a fila precisa de cada pedido (JSON da regulacao_fila + regulacao_fila_extras). */
export type PedidoFila = {
  id: string; numero: number; status: StatusRegulacao
  prioridade: Prioridade; prioridade_regulador?: Prioridade | null
  tipo_leito: string | null; isolamento: boolean; isolamento_tipo: string | null
  /** B-04 (RT, 25/11/2026): todos os tipos do pedido (regulacao_json); vazio ou ausente = só o principal */
  isolamento_tipos?: string[] | null
  vulnerabilidades?: Vulnerabilidade[] | null
  espera_segundos: number; sla: Sla | null
  origem: { id: string; nome: string }
  paciente: { nome: string }
  cid?: string | null; cid_descricao?: string | null; externo_protocolo?: string | null
  /** de regulacao_fila_extras */
  municipio?: string | null; agente?: string | null; situacao?: string | null
  /** estado da conversa (regulacao_json, migration 20270426000045): o que a central espera da origem */
  conversa?: { aguardando?: { intencao: string }[] | null } | null
}

/**
 * A central espera resposta da origem: a pergunta formal (pendência) ou
 * mensagem da central na conversa depois da última da origem (pergunta,
 * pedido de dado ou exame). É a mesma regra do NIR e da lista do médico
 * (esperaAOrigem em regulacaoPaciente.ts, sem o devolvido, que tem atalho próprio).
 */
export function centralEsperaResposta(s: Pick<PedidoFila, 'status' | 'conversa'>): boolean {
  return s.status === 'pendencia' || (s.conversa?.aguardando?.length ?? 0) > 0
}

export type Extra = {
  id: string; isolamento_situacao: string | null; isolamento_agente: string | null
  origem_municipio: string | null; origem_uf: string | null
  origem_latitude: number | null; origem_longitude: number | null; evolucoes: number
}

/** Junta o JSON da fila com os extras (o que não tiver extra fica como veio). */
export function comExtras<T extends PedidoFila>(itens: T[], extras: Extra[] | undefined): T[] {
  const m = new Map((extras ?? []).map((e) => [e.id, e]))
  return itens.map((s) => {
    const e = m.get(s.id)
    return e ? { ...s, municipio: e.origem_municipio, agente: e.isolamento_agente, situacao: e.isolamento_situacao } : s
  })
}

// ── evolução ────────────────────────────────────────────────────────────────
export type NivelEvolucao = 'em_dia' | 'vencida' | 'risco'

/** Horas inteiras desde a última evolução (null: o pedido não tem relógio de evolução). */
export function horasSemEvolucao(sla: Sla | null | undefined, agoraMs: number): number | null {
  if (!sla?.evolucao) return null
  return Math.max(0, Math.floor((agoraMs - Date.parse(sla.evolucao.ultima_em)) / 3_600_000))
}

/** Âmbar passado o prazo da evolução da central; vermelho no prazo de cancelamento. */
export function nivelEvolucao(sla: Sla | null | undefined): NivelEvolucao {
  if (!sla?.evolucao) return 'em_dia'
  if (sla.evolucao.risco_cancelamento) return 'risco'
  return sla.evolucao.atrasada ? 'vencida' : 'em_dia'
}

/** Mensagem pronta para cobrar a evolução na conversa (autor = quem envia). */
export function mensagemCobrarEvolucao(s: { numero: number; sla: Sla | null }, agoraMs: number): string {
  const h = horasSemEvolucao(s.sla, agoraMs)
  const e = s.sla?.evolucao
  const prazo = e ? (e.risco_cancelamento ? `${e.limite_h} h, prazo de cancelamento da central` : `${e.prazo_h} h, prazo da central`) : null
  return `Pedido nº ${s.numero}: a evolução clínica está vencida${h != null ? ` (${tempoSemEvolucao(h)} sem evolução${prazo ? `; ${prazo}` : ''})` : ''}. `
    + 'Por favor, atualize a evolução no pedido (quadro atual, sinais vitais, suporte em uso e se o leito ainda é necessário).'
}

// ── isolamento ──────────────────────────────────────────────────────────────
export const temIsolamento = (s: Pick<PedidoFila, 'isolamento' | 'isolamento_tipo'>) => s.isolamento && !!s.isolamento_tipo
export const rotuloIsolamento = (tipo: string | null | undefined) => (tipo ? ISOLAMENTOS[tipo] ?? tipo : 'Sem isolamento')
export const ehJudicial = (s: Pick<PedidoFila, 'vulnerabilidades'>) => (s.vulnerabilidades ?? []).includes('judicializado')

/**
 * RO3 (revisão unslop, RT 25/11/2026): o selo da linha da fila diz o tipo e a
 * situação ("Gotícula · suspeito"), igual na central e na origem. Sem
 * situação, só o tipo.
 */
export function seloIsolamento(s: Pick<PedidoFila, 'isolamento_tipo' | 'isolamento_tipos' | 'situacao'>): string {
  const tipo = textoIsolamento(s) ?? rotuloIsolamento(s.isolamento_tipo)
  const sit = s.situacao ? SITUACOES_ISOLAMENTO[s.situacao as SituacaoIsolamento] ?? s.situacao : null
  return sit ? `${tipo} · ${sit.charAt(0).toLocaleLowerCase('pt-BR')}${sit.slice(1)}` : tipo
}
export const temVulnerabilidade = (s: Pick<PedidoFila, 'vulnerabilidades'>) => (s.vulnerabilidades ?? []).some((v) => v !== 'judicializado')

// ── filtros e atalhos ───────────────────────────────────────────────────────
export type Atalho = 'isolamento' | 'evolucao_vencida' | 'risco' | 'judicial' | 'vulnerabilidade' | 'perguntou' | 'devolvido'
/** Atalhos da central (modelo do RT). */
export const ATALHOS: [Atalho, string][] = [
  ['isolamento', 'Com isolamento'], ['evolucao_vencida', 'Evolução vencida'], ['risco', 'Risco de cancelamento'],
  ['judicial', 'Mandado judicial'], ['vulnerabilidade', 'Vulnerabilidade'],
]
/**
 * RO2 (revisão unslop, RT 25/11/2026): na unidade de origem os atalhos são o
 * que a origem tem de fazer. Mandado judicial e vulnerabilidade ficam no menu
 * Filtros (MARCAS).
 */
export const ATALHOS_ORIGEM: [Atalho, string][] = [
  ['perguntou', 'A central perguntou'], ['evolucao_vencida', 'Evolução vencida'], ['devolvido', 'Devolvidos'], ['risco', 'Risco de cancelamento'],
]
/** Marcas do pedido que, na origem, ficam no menu Filtros. */
export const MARCAS: [Atalho, string][] = [['judicial', 'Mandado judicial'], ['vulnerabilidade', 'Vulnerabilidade']]
export function casaAtalho(s: PedidoFila, a: Atalho): boolean {
  switch (a) {
    case 'isolamento': return temIsolamento(s)
    case 'evolucao_vencida': return nivelEvolucao(s.sla) !== 'em_dia'
    case 'risco': return nivelEvolucao(s.sla) === 'risco'
    case 'judicial': return ehJudicial(s)
    case 'vulnerabilidade': return temVulnerabilidade(s)
    case 'perguntou': return centralEsperaResposta(s)
    case 'devolvido': return s.status === 'devolvida'
  }
}
/** Contagem de cada atalho da lista (a da central, se nenhuma for dada). */
export function contarAtalhos(itens: PedidoFila[], lista: [Atalho, string][] = ATALHOS): Partial<Record<Atalho, number>> {
  const c: Partial<Record<Atalho, number>> = Object.fromEntries(lista.map(([a]) => [a, 0]))
  for (const s of itens) for (const [a] of lista) if (casaAtalho(s, a)) c[a] = (c[a] ?? 0) + 1
  return c
}

export type FiltrosLocais = {
  busca?: string
  /** '' todos · 'qualquer' · 'nenhum' · um tipo */
  isolamento?: string
  municipio?: string
  atalhos?: Atalho[]
}

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Busca do "/": paciente, nº, CID, município, unidade, agente ou protocolo. */
export function casaBusca(s: PedidoFila, termo: string): boolean {
  const t = semAcento(termo.trim())
  if (!t) return true
  return [s.paciente.nome, String(s.numero), s.cid, s.cid_descricao, s.municipio, s.origem.nome, s.agente, s.externo_protocolo]
    .some((v) => !!v && semAcento(String(v)).includes(t))
}

export function filtrarLocal<T extends PedidoFila>(itens: T[], f: FiltrosLocais): T[] {
  return itens.filter((s) => {
    if (f.busca && !casaBusca(s, f.busca)) return false
    if (f.isolamento === 'qualquer' && !temIsolamento(s)) return false
    if (f.isolamento === 'nenhum' && temIsolamento(s)) return false
    if (f.isolamento && f.isolamento !== 'qualquer' && f.isolamento !== 'nenhum' && s.isolamento_tipo !== f.isolamento) return false
    if (f.municipio && (s.municipio ?? '') !== f.municipio) return false
    return (f.atalhos ?? []).every((a) => casaAtalho(s, a))
  })
}

// ── ordenação e agrupamento ─────────────────────────────────────────────────
export type Ordem = 'gravidade' | 'maior_tempo' | 'evolucao_antiga'
export const ORDENS: Record<Ordem, string> = { gravidade: 'Gravidade + tempo', maior_tempo: 'Maior tempo na fila', evolucao_antiga: 'Evolução mais antiga' }

/** Não classificada primeiro (como a fila do banco), depois 1 a 4. */
export const pesoPrioridade = (p: Prioridade) => ({ nao_classificada: 0, emergencia: 1, urgencia: 2, prioritaria: 3, eletiva: 4 })[p]

export function ordenar<T extends PedidoFila>(itens: T[], ordem: Ordem): T[] {
  const ev = (s: PedidoFila) => (s.sla?.evolucao ? Date.parse(s.sla.evolucao.ultima_em) : Number.POSITIVE_INFINITY)
  return [...itens].sort((a, b) => {
    if (ordem === 'maior_tempo') return b.espera_segundos - a.espera_segundos || a.numero - b.numero
    if (ordem === 'evolucao_antiga') return ev(a) - ev(b) || b.espera_segundos - a.espera_segundos
    return pesoPrioridade(prioridadeEfetiva(a)) - pesoPrioridade(prioridadeEfetiva(b)) || b.espera_segundos - a.espera_segundos
  })
}

export type Agrupamento = 'prioridade' | 'leito' | 'municipio' | 'isolamento' | 'nenhum'
export const AGRUPAMENTOS: Record<Agrupamento, string> = {
  prioridade: 'Prioridade', leito: 'Tipo de leito', municipio: 'Município', isolamento: 'Isolamento', nenhum: 'Sem agrupamento',
}
export type Grupo<T> = { chave: string; rotulo: string; itens: T[] }

/** Grupos na ordem da ordenação de cada um (prioridade pela gravidade; os outros pelo nome). */
export function agrupar<T extends PedidoFila>(itens: T[], por: Agrupamento): Grupo<T>[] {
  if (por === 'nenhum') return [{ chave: 'todos', rotulo: 'Todos', itens }]
  const chave = (s: PedidoFila): [string, string] => {
    if (por === 'prioridade') { const p = prioridadeEfetiva(s); return [p, PRIORIDADES[p].rotulo] }
    if (por === 'leito') return s.tipo_leito ? [s.tipo_leito, TIPOS_LEITO[s.tipo_leito] ?? s.tipo_leito] : ['', 'Sem tipo de leito']
    if (por === 'municipio') return s.municipio ? [s.municipio, s.municipio] : ['', 'Município não informado']
    return temIsolamento(s) ? [s.isolamento_tipo!, rotuloIsolamento(s.isolamento_tipo)] : ['', 'Sem isolamento']
  }
  const m = new Map<string, Grupo<T>>()
  for (const s of itens) {
    const [k, r] = chave(s)
    if (!m.has(k)) m.set(k, { chave: k, rotulo: r, itens: [] })
    m.get(k)!.itens.push(s)
  }
  const grupos = [...m.values()]
  if (por === 'prioridade') return grupos.sort((a, b) => pesoPrioridade(a.chave as Prioridade) - pesoPrioridade(b.chave as Prioridade))
  return grupos.sort((a, b) => (a.chave === '' ? 1 : b.chave === '' ? -1 : a.rotulo.localeCompare(b.rotulo, 'pt-BR')))
}

/** Ids na ordem em que aparecem na tela (grupos recolhidos ficam de fora): J/K. */
export function idsVisiveis<T extends PedidoFila>(grupos: Grupo<T>[], recolhidos: Set<string>): string[] {
  return grupos.flatMap((g) => (recolhidos.has(g.chave) ? [] : g.itens.map((s) => s.id)))
}
export function vizinho(ids: string[], atual: string | null, passo: 1 | -1): string | null {
  if (ids.length === 0) return null
  const i = atual ? ids.indexOf(atual) : -1
  if (i < 0) return passo === 1 ? ids[0] : ids[ids.length - 1]
  return ids[Math.min(ids.length - 1, Math.max(0, i + passo))]
}

// ── vagas compatíveis (RG3) ─────────────────────────────────────────────────
export type LeitosTipo = {
  tipo_leito: string; livre: number; reservado?: number; higienizacao?: number; ocupado?: number; total?: number
  livre_isolamento?: number; livre_pressao_negativa?: number
}
export type UnidadeVagas = {
  id: string; nome: string; cnes: string | null; municipio: string | null; uf: string | null
  latitude: number | null; longitude: number | null; leitos: LeitosTipo[]
}
export type Saldo = { geral: number; isolamento: number; pressao_negativa: number }

/** Saldo de livres do tipo pedido: geral (fora de isolamento), isolamento comum, pressão negativa. */
export function saldoDoTipo(u: Pick<UnidadeVagas, 'leitos'>, tipoLeito: string | null): Saldo {
  const l = u.leitos.filter((x) => !tipoLeito || x.tipo_leito === tipoLeito)
  const soma = (f: (x: LeitosTipo) => number) => l.reduce((t, x) => t + f(x), 0)
  const iso = soma((x) => x.livre_isolamento ?? 0)
  const pn = soma((x) => x.livre_pressao_negativa ?? 0)
  return { geral: Math.max(0, soma((x) => x.livre) - iso - pn), isolamento: iso, pressao_negativa: pn }
}

/**
 * Regra do RT (25/11/2026): aerossol e o combinado exigem pressão negativa;
 * os outros isolamentos aceitam isolamento comum ou pressão negativa; sem
 * isolamento, qualquer leito livre do tipo.
 */
export function compatibilidade(isolamentoTipo: string | null, saldo: Saldo): { compativel: boolean; vagas: number; texto: string } {
  if (isolamentoTipo === 'aerossol' || isolamentoTipo === 'contato_aerossol') {
    const v = saldo.pressao_negativa
    return { compativel: v > 0, vagas: v, texto: v > 0 ? `${v} com pressão negativa` : 'Sem leito com pressão negativa livre' }
  }
  if (isolamentoTipo) {
    const v = saldo.isolamento + saldo.pressao_negativa
    return { compativel: v > 0, vagas: v, texto: v > 0 ? `${v} de isolamento` : 'Sem leito de isolamento livre' }
  }
  const v = saldo.geral + saldo.isolamento + saldo.pressao_negativa
  return { compativel: v > 0, vagas: v, texto: v > 0 ? `${v} livre(s)` : 'Sem leito livre' }
}

/** Distância em linha reta (km, haversine) só quando as duas pontas têm coordenadas. */
export function distanciaKm(a: { latitude: number | null; longitude: number | null } | null | undefined,
  b: { latitude: number | null; longitude: number | null } | null | undefined): number | null {
  if (a?.latitude == null || a.longitude == null || b?.latitude == null || b.longitude == null) return null
  const r = (g: number) => (g * Math.PI) / 180
  const dLat = r(b.latitude - a.latitude), dLon = r(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.latitude)) * Math.cos(r(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

export type LinhaMatch = { unidade: UnidadeVagas; saldo: Saldo; compativel: boolean; vagas: number; texto: string; km: number | null }

/**
 * Unidades com o tipo de leito pedido (fora a origem), compatíveis primeiro.
 * Por distância só quando todas as compatíveis têm distância; senão pelo saldo.
 */
export function matchVagas(pedido: { tipo_leito: string | null; isolamento_tipo: string | null; origem_id: string;
  origem?: { latitude: number | null; longitude: number | null } | null }, unidades: UnidadeVagas[]): LinhaMatch[] {
  const linhas = unidades
    .filter((u) => u.id !== pedido.origem_id && (!pedido.tipo_leito || u.leitos.some((l) => l.tipo_leito === pedido.tipo_leito)))
    .map((u) => {
      const saldo = saldoDoTipo(u, pedido.tipo_leito)
      return { unidade: u, saldo, ...compatibilidade(pedido.isolamento_tipo, saldo), km: distanciaKm(pedido.origem, u) }
    })
  const compat = linhas.filter((l) => l.compativel)
  const porDistancia = compat.length > 0 && compat.every((l) => l.km != null)
  return linhas.sort((a, b) => Number(b.compativel) - Number(a.compativel)
    || (porDistancia && a.compativel && b.compativel ? a.km! - b.km! : b.vagas - a.vagas)
    || a.unidade.nome.localeCompare(b.unidade.nome, 'pt-BR'))
}

// ── por município (RG6) ─────────────────────────────────────────────────────
export type LinhaMunicipio = {
  municipio: string; unidades: string[]; total: number; p1: number; p2: number; isolamento: number; risco: number
}
export function porMunicipio(itens: PedidoFila[]): LinhaMunicipio[] {
  const m = new Map<string, LinhaMunicipio & { _u: Set<string> }>()
  for (const s of itens) {
    const k = s.municipio ?? ''
    if (!m.has(k)) m.set(k, { municipio: k, unidades: [], total: 0, p1: 0, p2: 0, isolamento: 0, risco: 0, _u: new Set() })
    const l = m.get(k)!
    l._u.add(s.origem.nome); l.total++
    const p = prioridadeEfetiva(s)
    if (p === 'emergencia') l.p1++
    if (p === 'urgencia') l.p2++
    if (temIsolamento(s)) l.isolamento++
    if (nivelEvolucao(s.sla) === 'risco') l.risco++
  }
  return [...m.values()]
    .map(({ _u, ...l }) => ({ ...l, unidades: [..._u].sort((a, b) => a.localeCompare(b, 'pt-BR')) }))
    .sort((a, b) => b.total - a.total || a.municipio.localeCompare(b.municipio, 'pt-BR'))
}

// ── indicadores da fila (agora) ─────────────────────────────────────────────
export type LinhaDemandaIsolamento = { tipo: string; rotulo: string; aguardando: number; oferta: number }

/** Pedidos aguardando por tipo de isolamento × vagas compatíveis na rede (mesma regra do match). */
export function demandaIsolamento(itens: PedidoFila[], unidades: UnidadeVagas[]): LinhaDemandaIsolamento[] {
  const tipos = Object.keys(ISOLAMENTOS)
  const total = unidades.reduce((t, u) => {
    const s = saldoDoTipo(u, null)
    return { geral: t.geral + s.geral, isolamento: t.isolamento + s.isolamento, pressao_negativa: t.pressao_negativa + s.pressao_negativa }
  }, { geral: 0, isolamento: 0, pressao_negativa: 0 })
  return tipos
    .map((t) => ({ tipo: t, rotulo: ISOLAMENTOS[t], aguardando: itens.filter((s) => temIsolamento(s) && s.isolamento_tipo === t).length,
      oferta: compatibilidade(t, total).vagas }))
    .filter((l) => l.aguardando > 0)
}

export type LinhaPrioridade = { prioridade: Prioridade; casos: number; pct: number; evolucao_vencida: number; risco: number }
export function distribuicaoPrioridade(itens: PedidoFila[]): LinhaPrioridade[] {
  const ordem: Prioridade[] = ['nao_classificada', 'emergencia', 'urgencia', 'prioritaria', 'eletiva']
  return ordem.map((p) => {
    const xs = itens.filter((s) => prioridadeEfetiva(s) === p)
    return {
      prioridade: p, casos: xs.length, pct: itens.length ? Math.round((xs.length / itens.length) * 100) : 0,
      evolucao_vencida: xs.filter((s) => nivelEvolucao(s.sla) !== 'em_dia').length,
      risco: xs.filter((s) => nivelEvolucao(s.sla) === 'risco').length,
    }
  }).filter((l) => l.casos > 0)
}

export type LinhaLeito = { tipo_leito: string; rotulo: string; aguardando: number; com_isolamento: number; espera_media_seg: number; livres: Saldo }
export function esperaPorLeito(itens: PedidoFila[], unidades: UnidadeVagas[]): LinhaLeito[] {
  const tipos = [...new Set(itens.map((s) => s.tipo_leito).filter((t): t is string => !!t))]
  return tipos.map((t) => {
    const xs = itens.filter((s) => s.tipo_leito === t)
    const livres = unidades.reduce((a, u) => {
      const s = saldoDoTipo({ leitos: u.leitos.filter((l) => l.tipo_leito === t) }, t)
      return { geral: a.geral + s.geral, isolamento: a.isolamento + s.isolamento, pressao_negativa: a.pressao_negativa + s.pressao_negativa }
    }, { geral: 0, isolamento: 0, pressao_negativa: 0 })
    return {
      tipo_leito: t, rotulo: TIPOS_LEITO[t] ?? t, aguardando: xs.length, com_isolamento: xs.filter(temIsolamento).length,
      espera_media_seg: Math.round(xs.reduce((a, s) => a + s.espera_segundos, 0) / xs.length), livres,
    }
  }).sort((a, b) => b.aguardando - a.aguardando)
}

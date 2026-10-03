// ─────────────────────────────────────────────────────────────────────────────
// GATEWAY DE IA (JEV) — gateway/gateway.ts
// ADR 0006: TODA chamada a modelo passa por aqui. Nenhum outro módulo importa
// `completar` direto.
//
//   saída   → desidentifica cada mensagem (regex + nomes conhecidos) e passa
//             pelo NER obrigatório; resíduo, nome achado ou NER fora do ar
//             bloqueiam (falha fechada)
//   modelo  → lib/llm.ts (provider-agnóstico; hoje DeepSeek, fora do Brasil)
//   entrada → reidentifica resposta e argumentos de ferramenta; pseudônimo
//             inventado pelo modelo é descartado
//   registro→ ia_gateway_log: contagens, provedor, latência, hash — nunca texto
// ─────────────────────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto'

import { completar, type ChamadaLLM, type MensagemLLM, type RespostaLLM, type ToolCallLLM } from '../lib/llm.js'
import { inserirGatewayLog } from '../lib/db-job.js'
import { logger } from '../logger.js'
import {
  desidentificar, reidentificar, residuos,
  type Cofre, type Conhecido, type Contagem, type Residuo,
} from './desidentificacao.js'

export { nomesEmResultado } from './desidentificacao.js'

export class ChamadaBloqueada extends Error {
  readonly residuos: Residuo[]
  constructor(achados: Residuo[]) {
    super(`gateway: ${achados.length} possível(is) identificador(es) no texto; chamada não enviada`)
    this.name = 'ChamadaBloqueada'
    this.residuos = achados
  }
}

export type ContextoGateway = {
  /** Cofre da conversa: o mesmo valor recebe o mesmo pseudônimo em todas as voltas. */
  cofre: Cofre
  /** Identificadores que o servidor já conhece (nome do usuário, nomes vindos de ferramentas). */
  conhecidos: Conhecido[]
  /** De onde veio a chamada — vai para o registro. */
  origem: string
  perfilId?: string | null
  /**
   * NER não lê as mensagens de sistema. Só para quem monta o próprio prompt de
   * sistema com texto fixo do operador (Corujinha: instruções do Nous, com a
   * memória desligada). Regex e resíduo continuam valendo para o sistema.
   */
  nerIgnoraSistema?: boolean
}

function somar(total: Contagem, parcial: Contagem) {
  for (const [k, n] of Object.entries(parcial) as [keyof Contagem, number][]) total[k] = (total[k] ?? 0) + n
}

// ── NER obrigatório (falha fechada) ─────────────────────────────────────────
// Red-team V5: passo de NER (nomes próprios) pelo serviço /v1/deid da
// biblioteca, que a regex não pega. Decisão do RT (02/10/2026): o NER é
// OBRIGATÓRIO. Sem configuração, com o serviço fora, timeout, resposta não-2xx,
// resposta malformada ou com o modelo spaCy desligado (`ner_ativo` != true), a
// chamada NÃO sai: lança DesidentificacaoIndisponivel. A limpeza por regex e
// nomes conhecidos continua rodando como camada a mais — nunca como substituta.
//
// Ordem: regex/nomes conhecidos primeiro e NER sobre o texto já pseudonimizado.
// Se o NER visse o texto cru, o próprio nome do usuário e os nomes devolvidos
// pelas ferramentas (que já viram [PESSOA_n]) bloqueariam toda conversa.

/** Texto padrão para quem conversa quando o NER não está disponível. */
export const MSG_DESIDENTIFICACAO_INDISPONIVEL =
  'Desidentificação indisponível; tente mais tarde. Sua mensagem não foi enviada ao assistente.'

/** Texto padrão quando sobra possível identificador depois da limpeza. */
export const MSG_CHAMADA_BLOQUEADA =
  'Não enviei sua mensagem ao assistente: ela parece ter um dado que identifica alguém (nome, número de documento, data completa ou e-mail). Reescreva sem esse dado, por favor.'

export type MotivoIndisponivel =
  | 'sem_configuracao' | 'timeout' | 'rede' | 'http' | 'resposta_invalida' | 'ner_inativo'

export class DesidentificacaoIndisponivel extends Error {
  readonly motivo: MotivoIndisponivel
  constructor(motivo: MotivoIndisponivel, detalhe?: string) {
    // Nunca o texto da conversa: só o motivo (e o status HTTP, quando houver).
    super(`gateway: desidentificação indisponível (${motivo}${detalhe ? `: ${detalhe}` : ''}); chamada não enviada`)
    this.name = 'DesidentificacaoIndisponivel'
    this.motivo = motivo
  }
}

export type ConfigNER = { url?: string; chave?: string; timeoutMs: number }

/** Lido a cada chamada (não no carregamento do módulo): a troca do .env vale no restart e os testes conseguem variar. */
export function configNER(): ConfigNER {
  return {
    url: process.env.DEID_URL?.trim() || undefined,
    chave: process.env.BIBLIOTECA_API_KEY?.trim() || undefined,
    timeoutMs: 5000,
  }
}

// O /v1/deid aceita até 8000 caracteres por texto (DeidReq em biblioteca/app/main.py).
const NER_MAX_CARACTERES = 7500
const NER_SOBREPOSICAO = 200

/** Quebra texto longo em pedaços que o /v1/deid aceita, com sobreposição para não cortar um nome ao meio. */
export function pedacosNER(texto: string): string[] {
  if (texto.length <= NER_MAX_CARACTERES) return [texto]
  const pedacos: string[] = []
  let inicio = 0
  while (inicio < texto.length) {
    let fim = Math.min(inicio + NER_MAX_CARACTERES, texto.length)
    if (fim < texto.length) {
      // corta no último espaço da janela, para não partir palavra
      const espaco = texto.lastIndexOf(' ', fim)
      if (espaco > inicio + NER_SOBREPOSICAO) fim = espaco
    }
    pedacos.push(texto.slice(inicio, fim))
    if (fim >= texto.length) break
    inicio = Math.max(fim - NER_SOBREPOSICAO, inicio + 1)
  }
  return pedacos
}

// Nomes do próprio produto (agentes e sistema) que o NER pode marcar como
// pessoa nos prompts de sistema. Só a correspondência exata sai da lista.
/** Pseudônimo do próprio gateway ([PESSOA_1], PACIENTE_2…): o NER às vezes o marca como nome. */
const RE_PSEUDONIMO = /\[?\b(?:PESSOA|PACIENTE|CPF|CNS|TELEFONE|EMAIL|CEP|DATA|PRONTUARIO)_\d+\b\]?/g
/** Sobra letra depois de tirar os pseudônimos? Se não, não é nome de ninguém. */
const CONECTIVOS = new Set(['e', 'de', 'da', 'do', 'das', 'dos'])
/** Máscara de formato (AAAA-MM-DD, DD/MM/AAAA, HH:MM) que aparece nas descrições das ferramentas. */
const MASCARA = /^(?:AAAA|AA|MM|DD|HH|SS)$/
export const temNomeAlemDoPseudonimo = (n: string) =>
  n.replace(RE_PSEUDONIMO, ' ').split(/[^\p{L}]+/u).some((w) => w && !CONECTIVOS.has(w.toLowerCase()) && !MASCARA.test(w))

const NOMES_DO_SISTEMA = new Set([
  'corujinha', 'chefe coruja', 'coruja', 'gaviao', 'hermes', 'cerbero', 'iris', 'argos',
  'aguia', 'garca', 'picapau', 'pica-pau', 'sentinela', 'falcao',
])
const normalizarNome = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/**
 * Pergunta ao /v1/deid quais nomes de pessoa há no texto. Lança
 * DesidentificacaoIndisponivel em QUALQUER falha — nunca devolve "nada achado"
 * por não ter conseguido olhar.
 */
export async function nomesNER(texto: string, cfg: ConfigNER = configNER()): Promise<string[]> {
  if (!cfg.url || !cfg.chave) throw new DesidentificacaoIndisponivel('sem_configuracao')
  if (!texto.trim()) return []
  const achados: string[] = []
  for (const pedaco of pedacosNER(texto)) {
    let r: Response
    try {
      r = await fetch(cfg.url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfg.chave}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: pedaco }),
        signal: AbortSignal.timeout(cfg.timeoutMs),
      })
    } catch (err) {
      const nome = (err as Error).name
      throw new DesidentificacaoIndisponivel(nome === 'TimeoutError' || nome === 'AbortError' ? 'timeout' : 'rede')
    }
    if (!r.ok) throw new DesidentificacaoIndisponivel('http', String(r.status))
    let j: { found?: unknown; ner_ativo?: unknown }
    try {
      j = (await r.json()) as typeof j
    } catch {
      throw new DesidentificacaoIndisponivel('resposta_invalida')
    }
    if (!j || typeof j !== 'object' || !Array.isArray(j.found) || !j.found.every((n) => typeof n === 'string')) {
      throw new DesidentificacaoIndisponivel('resposta_invalida')
    }
    // Sem o modelo spaCy a biblioteca devolve found:[] — isso é "só regex", não NER.
    if (j.ner_ativo !== true) throw new DesidentificacaoIndisponivel('ner_inativo')
    achados.push(...(j.found as string[]).filter((n) => temNomeAlemDoPseudonimo(n) && !NOMES_DO_SISTEMA.has(normalizarNome(n))))
  }
  return achados
}

async function bloquearSeNomeNER(
  mensagens: MensagemLLM[],
  achados: Residuo[],
  ner: (texto: string) => Promise<string[]>,
  ignorarSistema = false,
): Promise<void> {
  const textos = new Set<string>()
  for (const m of mensagens) {
    if (ignorarSistema && m.role === 'system') continue
    if (m.content?.trim()) textos.add(m.content)
    for (const tc of m.tool_calls ?? []) if (tc.function.arguments.trim()) textos.add(tc.function.arguments)
  }
  // Uma chamada por texto distinto, de 4 em 4 (não afogar o serviço com o
  // histórico inteiro de uma vez); qualquer falha derruba o envio inteiro.
  const lista = [...textos]
  for (let i = 0; i < lista.length; i += 4) {
    const resultados = await Promise.all(lista.slice(i, i + 4).map((t) => ner(t)))
    for (const nomes of resultados) {
      if (nomes.length) achados.push({ tipo: 'nome próprio (NER)', trecho: '[nome]' })
    }
  }
}

function limparMensagem(m: MensagemLLM, ctx: ContextoGateway, total: Contagem, achados: Residuo[]): MensagemLLM {
  const { texto, contagem } = desidentificar(m.content ?? '', ctx.cofre, ctx.conhecidos)
  somar(total, contagem)
  achados.push(...residuos(texto))
  const tool_calls = m.tool_calls?.map((tc) => {
    const r = desidentificar(tc.function.arguments, ctx.cofre, ctx.conhecidos)
    somar(total, r.contagem)
    achados.push(...residuos(r.texto))
    return { ...tc, function: { ...tc.function, arguments: r.texto } }
  })
  return { ...m, content: texto, ...(tool_calls ? { tool_calls } : {}) }
}

function reidentificarChamadas(tcs: ToolCallLLM[], cofre: Cofre): ToolCallLLM[] {
  return tcs.map((tc) => ({ ...tc, function: { ...tc.function, arguments: reidentificar(tc.function.arguments, cofre) } }))
}

type DadosRegistro = {
  bloqueado: boolean; contagem: Contagem; residuos: number; hashEntrada: string;
  provedor?: string; modelo?: string; latenciaMs?: number; erro?: string
}

async function registrar(ctx: ContextoGateway, dados: DadosRegistro) {
  try {
    const { error } = await inserirGatewayLog({
      origem: ctx.origem,
      perfil_id: ctx.perfilId ?? null,
      bloqueado: dados.bloqueado,
      substituicoes: dados.contagem,
      residuos: dados.residuos,
      hash_entrada: dados.hashEntrada,
      provedor: dados.provedor ?? null,
      modelo: dados.modelo ?? null,
      latencia_ms: dados.latenciaMs ?? null,
      erro: dados.erro ? dados.erro.slice(0, 200) : null,
    })
    // O registro nunca derruba a conversa — mas a falha fica no log técnico.
    if (error) logger.warn({ err: error.message }, '[gateway] falha ao registrar chamada')
  } catch (err) {
    logger.warn({ err: (err as Error).message }, '[gateway] falha ao registrar chamada')
  }
}

/** Pontos de troca para teste (sem rede): modelo, NER e registro. */
export type DependenciasGateway = {
  completar: (body: ChamadaLLM) => Promise<RespostaLLM>
  ner: (texto: string) => Promise<string[]>
  registrar: (ctx: ContextoGateway, dados: DadosRegistro) => Promise<void>
}

/**
 * A única porta para o modelo. Lança:
 *  - DesidentificacaoIndisponivel se o NER não puder ser consultado (falha fechada);
 *  - ChamadaBloqueada se, depois da limpeza, sobrar algo com cara de identificador.
 * Nos dois casos o modelo NÃO é chamado e o registro guarda só contagens e hash.
 */
export async function chamarIA(
  body: ChamadaLLM,
  ctx: ContextoGateway,
  deps: Partial<DependenciasGateway> = {},
): Promise<RespostaLLM> {
  const chamarModelo = deps.completar ?? completar
  const ner = deps.ner ?? ((texto: string) => nomesNER(texto))
  const registrarChamada = deps.registrar ?? registrar

  const hashEntrada = createHash('sha256').update(JSON.stringify(body.mensagens)).digest('hex')
  const contagem: Contagem = {}
  const achados: Residuo[] = []
  const mensagens = body.mensagens.map((m) => limparMensagem(m, ctx, contagem, achados))

  try {
    await bloquearSeNomeNER(mensagens, achados, ner, ctx.nerIgnoraSistema === true)  // red-team V5 + RT 02/10: NER obrigatório
  } catch (err) {
    if (err instanceof DesidentificacaoIndisponivel) {
      // Auditoria sem texto: origem, contagens, hash e o motivo.
      logger.warn({ origem: ctx.origem, motivo: err.motivo }, '[gateway] desidentificação indisponível — chamada não enviada')
      await registrarChamada(ctx, { bloqueado: true, contagem, residuos: achados.length, hashEntrada, erro: err.message })
    }
    throw err
  }

  if (achados.length) {
    await registrarChamada(ctx, { bloqueado: true, contagem, residuos: achados.length, hashEntrada })
    throw new ChamadaBloqueada(achados)
  }

  try {
    const r = await chamarModelo({ ...body, mensagens })
    await registrarChamada(ctx, {
      bloqueado: false, contagem, residuos: 0, hashEntrada,
      provedor: r.provedor, modelo: r.modelo, latenciaMs: r.latenciaMs,
    })
    return { ...r, conteudo: reidentificar(r.conteudo, ctx.cofre), toolCalls: reidentificarChamadas(r.toolCalls, ctx.cofre) }
  } catch (err) {
    await registrarChamada(ctx, { bloqueado: false, contagem, residuos: 0, hashEntrada, erro: (err as Error).message })
    throw err
  }
}

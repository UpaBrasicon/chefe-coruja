// Trilha Hermes / Evidências, E2 (decisão do RT de 12/11/2026,
// docs/hermes/HERMES-EVIDENCIAS-DIAGNOSTICO.md): a pergunta só sai para a
// biblioteca depois de passar por aqui. É a única função que produz uma
// PerguntaLiberada, e a chamada à biblioteca (index.ts) só aceita esse tipo.
//
// Ordem, a mesma da porta única do Hermes (hermes/src/gateway/gateway.ts):
//   1. desidentificar com os nomes conhecidos da unidade (pseudônimos);
//   2. resíduo com cara de identificador: bloqueia;
//   3. no modo "ask" (que vai ao modelo de linguagem), o NER da biblioteca
//      (/v1/deid) confere nomes de pessoa em texto corrido. NER fora do ar,
//      sem o modelo carregado ou com resposta estranha: não sai (falha fechada).
//      Nome encontrado: bloqueia.
// Nada aqui guarda ou devolve o texto original; o registro leva só contagens,
// tipos e o hash da entrada.
import { criarCofre, desidentificar, residuos, type Conhecido, type Contagem } from '../_shared/desidentificacao.ts'

declare const liberada: unique symbol
/** Texto que passou pela desidentificação e pelas conferências. */
export type PerguntaLiberada = string & { readonly [liberada]: true }

export type RespostaDeid = { found: string[]; ner_ativo: boolean }
/** Consulta ao /v1/deid da biblioteca; lança se a rede falhar. */
export type ConsultarDeid = (texto: string) => Promise<unknown>

export type Liberacao =
  | { tipo: 'ok'; texto: PerguntaLiberada; contagem: Contagem }
  | { tipo: 'bloqueada'; tipos: Record<string, number>; contagem: Contagem }
  | { tipo: 'indisponivel'; motivo: string; contagem: Contagem }

export const TIPO_NOME_NER = 'nome próprio (NER)'

const RE_PSEUDONIMO = /\[[A-Z]+_\d+\]/g
const CONECTIVOS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])
// nomes do próprio sistema que o NER pode marcar como pessoa
const NOMES_DO_SISTEMA = new Set(['corujinha', 'chefe coruja', 'coruja', 'hermes'])

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** O achado do NER tem alguma palavra além dos pseudônimos e dos conectivos? */
export function nomeAlemDoPseudonimo(achado: string): boolean {
  if (NOMES_DO_SISTEMA.has(normalizar(achado))) return false
  return achado.replace(RE_PSEUDONIMO, ' ').split(/[^\p{L}]+/u).some((w) => w && !CONECTIVOS.has(w.toLowerCase()))
}

function lerDeid(j: unknown): RespostaDeid | null {
  if (!j || typeof j !== 'object') return null
  const r = j as { found?: unknown; ner_ativo?: unknown }
  if (!Array.isArray(r.found) || !r.found.every((n) => typeof n === 'string')) return null
  return { found: r.found as string[], ner_ativo: r.ner_ativo === true }
}

export async function liberarPergunta(
  q: string,
  conhecidos: Conhecido[],
  modo: 'ask' | 'search',
  consultarDeid: ConsultarDeid,
): Promise<Liberacao> {
  const limpo = desidentificar(q, criarCofre(), conhecidos)
  const contagem = limpo.contagem

  const sobras = residuos(limpo.texto)
  if (sobras.length) {
    const tipos: Record<string, number> = {}
    for (const s of sobras) tipos[s.tipo] = (tipos[s.tipo] ?? 0) + 1
    return { tipo: 'bloqueada', tipos, contagem }
  }

  // A busca simples não vai ao modelo de linguagem: só a pergunta ao modelo
  // passa pelo NER (cada tecla da busca não espera o NER).
  if (modo === 'ask') {
    let resposta: unknown
    try {
      resposta = await consultarDeid(limpo.texto)
    } catch (e) {
      const nome = e instanceof Error ? e.name : ''
      return { tipo: 'indisponivel', motivo: nome === 'TimeoutError' || nome === 'AbortError' ? 'timeout' : 'rede', contagem }
    }
    const deid = lerDeid(resposta)
    if (!deid) return { tipo: 'indisponivel', motivo: 'resposta_invalida', contagem }
    if (!deid.ner_ativo) return { tipo: 'indisponivel', motivo: 'ner_inativo', contagem }
    const nomes = deid.found.filter(nomeAlemDoPseudonimo)
    if (nomes.length) return { tipo: 'bloqueada', tipos: { [TIPO_NOME_NER]: nomes.length }, contagem }
  }

  return { tipo: 'ok', texto: limpo.texto as PerguntaLiberada, contagem }
}

/** sha256 em hexadecimal, para o registro sem texto. */
export async function hashEntrada(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

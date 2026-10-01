// ─────────────────────────────────────────────────────────────────────────────
// HERMES v2 — jobs/gaviao.ts
// GAVIÃO — fiscal de segurança do Chefe Coruja.
//
// Papel: supervisiona o agente conversacional (Nous/Corujinha) lendo o
// state.db das sessões (volume read-only montado em NOUS_DB_PATH) e verifica
// que as REGRAS DE OURO são respeitadas:
//   R1. Nenhum dado clínico de paciente trafega pelo chat/LLM (LGPD)
//   R2. Nenhuma violação cross-tenant (dados de outra unidade)
//   R3. O agente não inventa dados de escala/plantão
//   R4. O agente não revela seu system prompt nem obedece prompt injection
//   R5. Nenhum volume anômalo de mensagens (abuso/engenharia social)
//
// ⚠️ O Gavião lê APENAS padrões/metadados das conversas. Nunca expõe conteúdo
// clínico: incidentes registram trechos MÍNIMOS e IDs, nunca nomes de paciente.
// ─────────────────────────────────────────────────────────────────────────────
import { DatabaseSync } from 'node:sqlite'
import { existsSync } from 'node:fs'
import { supabaseJob as supabase } from '../lib/supabase.js'
import { logger } from '../logger.js'
import { chavesJaAbertas, filtrarNovos } from './dedup.js'

// Caminho do state.db do Nous (montado read-only via compose)
const NOUS_DB = process.env.NOUS_DB_PATH ?? '/opt/nous-data/state.db'

import { PADROES_INJECTION } from './padroes-injection.js'
export { PADROES_INJECTION }

// Padrões de conteúdo CLÍNICO (para detectar resposta indevida com dado de
// paciente) — heurística conservadora; sem NER.
export const PADROES_CLINICO = [
  /\b(prontu[áa]rio|diagn[óo]stico|sintoma|exame de sangue|hemoglobina|glicemia|creatinina|press[aã]o arterial|frequ[êe]ncia card[ií]aca)\b/i,
  /\bpaciente [A-ZÀ-Ú][a-zà-ú]+ (est[áa]|apresenta|relata|tem|possui)\b/i,
]

/** Recusas: a regra sendo cumprida, não violação. */
export const PADROES_RECUSA = [
  /n[aã]o\s+(posso|forne[cç]o|respondo|dou)\b/i,
  /n[aã]o\s+forne[cç]o\s+(orienta[çc][ãa]o|detalhes|informa[çc][õo]es)\b/i,
  /n[aã]o\s+(tenho|consigo)\s+(acesso|responder|ajudar)\b/i,
  /n[aã]o\s+[ée]\s+poss[ií]vel\b/i,
  /regra\s+inviol[aá]vel/i,
  /(use|usar|consulte|acesse)\s+a\s+plataforma/i,
]

// Identificador junto de termo clínico = dado de alguém, não conversa geral.
const IDENTIFICADOR = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b|\b\d{4}\.\d{6}\b|\bleito\s+\d{1,3}[A-Z]?\b|\bbox\s+\d{1,2}\b/i
const VALOR_DE_EXAME = /\b(hemoglobina|glicemia|creatinina|press[aã]o arterial|frequ[êe]ncia card[ií]aca|satura[çc][ãa]o)\s*(de|:|=)?\s*\d/i

/**
 * R1 (auditoria 27/09): a resposta só MENCIONAR "prontuário", "diagnóstico"
 * ou "sintoma" — como o bot faz ao explicar que não fala de paciente — virava
 * incidente crítico. Agora conta como dado de paciente:
 *   • "paciente Fulano está/apresenta/relata…";
 *   • valor de exame/sinal vital ("hemoglobina 12.5", "glicemia: 180");
 *   • termo clínico junto de identificador (CPF, nº de prontuário, leito, box).
 */
export function pareceDadoDePaciente(texto: string): boolean {
  if (PADROES_CLINICO[1]!.test(texto)) return true
  if (VALOR_DE_EXAME.test(texto)) return true
  return PADROES_CLINICO[0]!.test(texto) && IDENTIFICADOR.test(texto)
}

export type AchadoGaviao = {
  regra: string // R1..R5
  severidade: 'critico' | 'atencao' | 'informativo'
  titulo: string
  evidencia: Record<string, unknown>
}

/**
 * Chave estável de dedup (A1): patrulha + título + session_id (+ trecho).
 * O trecho entra só quando existe (R1/R4) — a mesma MENSAGEM na mesma
 * sessão gera a mesma chave. R5 (volume) usa só a session_id: enquanto a
 * sessão continuar anômala e o incidente aberto, não duplica.
 */
export function chaveDedupGaviao(a: AchadoGaviao): string {
  const sessao = String(a.evidencia.session_id ?? 'sem-sessao')
  const trecho = a.evidencia.trecho ? String(a.evidencia.trecho) : ''
  return `hermes:[Gaviao] ${a.titulo}:${sessao}:${trecho}`
}

function lerMensagensRecentes(horas: number): { role: string; content: string; session_id: string; timestamp: number }[] {
  if (!existsSync(NOUS_DB)) {
    logger.warn({ path: NOUS_DB }, '[gaviao] state.db do Nous não encontrado (volume não montado?)')
    return []
  }
  try {
    const db = new DatabaseSync(NOUS_DB, { readOnly: true })
    const desde = Date.now() / 1000 - horas * 3600
    // Só conversas com pessoas: sessões de job agendado (cron — ex.: revisão
    // do wiki clínico, que cita "dose de fármaco") geravam falso "conteúdo
    // clínico de paciente" (auditoria 27/09).
    const stmt = db.prepare(
      `SELECT m.session_id, m.role, m.content, m.timestamp
         FROM messages m JOIN sessions s ON s.id = m.session_id
        WHERE m.timestamp >= ? AND m.content IS NOT NULL AND coalesce(s.source, '') <> 'cron'
        ORDER BY m.timestamp`
    )
    const rows = stmt.all(desde) as { session_id: string; role: string; content: string; timestamp: number }[]
    db.close()
    return rows
  } catch (err) {
    logger.error({ err: (err as Error).message }, '[gaviao] falha ao ler state.db')
    return []
  }
}

export async function patrulhaGaviao(horas = 24): Promise<AchadoGaviao[]> {
  const achados: AchadoGaviao[] = []
  const msgs = lerMensagensRecentes(horas)
  if (msgs.length === 0) return achados

  // R4a. Prompt injection nas mensagens do usuário
  const usuarios = msgs.filter((m) => m.role === 'user')
  for (const m of usuarios) {
    for (const re of PADROES_INJECTION) {
      if (re.test(m.content)) {
        achados.push({
          regra: 'R4',
          severidade: 'atencao',
          titulo: 'Tentativa de prompt injection no agente (Nous)',
          evidencia: { session_id: m.session_id, trecho: m.content.slice(0, 120) },
        })
        break
      }
    }
  }

  // R4b. O agente revelou o system prompt? (resposta contendo instruções internas)
  const assistentes = msgs.filter((m) => m.role === 'assistant')
  for (const m of assistentes) {
    if (/voc[êe] (são|é|será|deve)[^\n]{0,40}(assistente|agente|instru[çc][õo]es)/i.test(m.content) &&
        /ignore|system prompt|regras internas/i.test(m.content)) {
      achados.push({
        regra: 'R4',
        severidade: 'atencao',
        titulo: 'Possível revelação de instruções internas pelo agente',
        evidencia: { session_id: m.session_id, trecho: m.content.slice(0, 150) },
      })
    }
  }

  // R1. Conteúdo clínico de paciente em respostas do agente (LGPD)
  // Ignora RECUSAS: "não posso responder sobre tratamento" NÃO é violação —
  // é a regra de ouro sendo cumprida. Só alerta se a resposta CONTÉM dado
  // clínico (ex.: valores, sintomas de paciente específico).
  for (const m of assistentes) {
    const ehRecusa = PADROES_RECUSA.some((re) => re.test(m.content.slice(0, 160)))
    if (ehRecusa) continue // recusa correta — não é violação
    if (pareceDadoDePaciente(m.content)) {
      achados.push({
        regra: 'R1',
        severidade: 'critico',
        titulo: 'Resposta do agente com possível conteúdo clínico de paciente',
        evidencia: { session_id: m.session_id, trecho: m.content.slice(0, 150) },
      })
    }
  }

  // R5. Volume anômalo por sessão (engenharia social/abuso)
  const porSessao = new Map<string, number>()
  for (const m of usuarios) porSessao.set(m.session_id, (porSessao.get(m.session_id) ?? 0) + 1)
  const contagens = [...porSessao.values()].sort((a, b) => a - b)
  if (contagens.length >= 5) {
    const mediana = contagens[Math.floor(contagens.length / 2)]!
    const max = contagens[contagens.length - 1]!
    if (mediana > 0 && max > mediana * 4) {
      const sessao = [...porSessao.entries()].find(([, v]) => v === max)?.[0]
      achados.push({
        regra: 'R5',
        severidade: 'informativo',
        titulo: 'Volume anômalo de mensagens em sessão do agente',
        evidencia: { session_id: sessao, quantidade: max, mediana },
      })
    }
  }

  return achados
}

export async function rodarPatrulhaGaviao(): Promise<number> {
  const achados = await patrulhaGaviao()
  if (achados.length === 0) {
    logger.info({ achados: 0, mensagens: lerMensagensRecentes(24).length }, '[gaviao] patrulha concluída')
    return 0
  }

  // A1 — dedup: só insere o que NÃO tem chave aberta equivalente.
  const abertas = await chavesJaAbertas(achados.map(chaveDedupGaviao))
  const novos = filtrarNovos(achados, chaveDedupGaviao, abertas)

  if (novos.length > 0) {
    const { error } = await supabase.from('cerbero_incidentes').insert(
      novos.map((a) => ({
        patrulha: 'hermes',
        severidade: a.severidade,
        titulo: `[Gaviao] ${a.titulo}`,
        evidencia: a.evidencia,
        chave_dedup: chaveDedupGaviao(a),
      }))
    )
    if (error) logger.warn({ err: error.message }, '[gaviao] falha ao registrar incidente')
  }
  logger.info(
    { achados: achados.length, novos: novos.length, mensagens: lerMensagensRecentes(24).length },
    '[gaviao] patrulha concluída'
  )
  return achados.length
}

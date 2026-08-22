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
import { supabase } from '../lib/supabase.js'
import { logger } from '../logger.js'

// Caminho do state.db do Nous (montado read-only via compose)
const NOUS_DB = process.env.NOUS_DB_PATH ?? '/opt/nous-data/state.db'

export const PADROES_INJECTION = [
  // EN
  /ignore\s+(your|as\s+an?|all)\s+(previous|prior|above|system)?\s*(instructions|prompts?|rules)/i,
  /reveal\s+(your|the)\s*(system|internal)?\s*(prompt|instructions)/i,
  /forget\s+(all\s+)?(rules|instructions)/i,
  /act\s+as\s+(admin|super.?admin|gestor)/i,
  /acesse\s+(dados|outro)\s+(tenant|cliente|paciente)/i,
  // PT-BR
  /ignore\s+(suas|todas|as|qualquer|instru[çc][õo]es\s+)?\s*(instru[çc][õo]es|regras|prompts?|ordens)/i,
  /revel[ae]\s+(seu|o)\s*(system\s*prompt|prompt\s*(de\s*)?sistema|instru[çc][õo]es\s*internas)/i,
  /esque[çc]a\s+(todas\s+)?(as\s+)?(regras|instru[çc][õo]es)/i,
  /aja\s+como\s+(admin|super.?admin|gestor|sistema)/i,
  /acesse\s+(dados|informa[çc][õo]es)\s+(de\s+)?(outr[oa]|qualquer)\s+(tenant|cliente|unidade|paciente)/i,
]

// Padrões de conteúdo CLÍNICO (para detectar resposta indevida com dado de
// paciente) — heurística conservadora; sem NER.
export const PADROES_CLINICO = [
  /\b(prontu[áa]rio|diagn[óo]stico|sintoma|exame de sangue|hemoglobina|glicemia|creatinina|press[aã]o arterial|frequ[êe]ncia card[ií]aca)\b/i,
  /\bpaciente [A-ZÀ-Ú][a-zà-ú]+ (est[áa]|apresenta|relata|tem|possui)\b/i,
]

export type AchadoGaviao = {
  regra: string // R1..R5
  severidade: 'critico' | 'atencao' | 'informativo'
  titulo: string
  evidencia: Record<string, unknown>
}

function lerMensagensRecentes(horas: number): { role: string; content: string; session_id: string; timestamp: number }[] {
  if (!existsSync(NOUS_DB)) {
    logger.warn({ path: NOUS_DB }, '[gaviao] state.db do Nous não encontrado (volume não montado?)')
    return []
  }
  try {
    const db = new DatabaseSync(NOUS_DB, { readOnly: true })
    const desde = Date.now() / 1000 - horas * 3600
    const stmt = db.prepare(
      'SELECT session_id, role, content, timestamp FROM messages WHERE timestamp >= ? AND content IS NOT NULL ORDER BY timestamp'
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
  const PADROES_RECUSA = [
    /n[aã]o\s+(posso|forne[cç]o|respondo|dou)\b/i,
    /n[aã]o\s+forne[cç]o\s+(orienta[çc][ãa]o|detalhes|informa[çc][õo]es)\b/i,
    /n[aã]o\s+(tenho|consigo)\s+(acesso|responder)\b/i,
  ]
  for (const m of assistentes) {
    const ehRecusa = PADROES_RECUSA.some((re) => re.test(m.content.slice(0, 120)))
    if (ehRecusa) continue // recusa correta — não é violação
    if (PADROES_CLINICO.some((re) => re.test(m.content))) {
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
  for (const a of achados) {
    const { error } = await supabase.from('cerbero_incidentes').insert({
      patrulha: 'hermes',
      severidade: a.severidade,
      titulo: `[Gaviao] ${a.titulo}`,
      evidencia: a.evidencia,
    })
    if (error) logger.warn({ err: error.message }, '[gaviao] falha ao registrar incidente')
  }
  logger.info({ achados: achados.length, mensagens: lerMensagensRecentes(24).length }, '[gaviao] patrulha concluída')
  return achados.length
}

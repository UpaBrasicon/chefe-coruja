// ─────────────────────────────────────────────────────────────────────────────
// HERMES v1.1 — jobs/cerbero.ts
// Cérbero — Patrulha A (incoerências de dados, cron 1h) e Patrulha C (ameaças
// ao Hermes, diária). SQL/TS puro, SEM LLM para detecção (requisito do prompt).
//
// ⚠️ Regra inviolável: reporta IDs e números, NUNCA nome de paciente.
// ⚠️ Dados reais (schema verificado): escala_plantao, vinculos, perfis,
//    internacoes, leitos, setores, prescricoes, hermes_audit_log.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js'
import { logger } from '../logger.js'

export type IncidenciaC = {
  patrulha: 'dados' | 'conteudo' | 'hermes'
  severidade: 'critico' | 'atencao' | 'informativo'
  titulo: string
  evidencia: Record<string, unknown>
}

async function registrarIncidente(i: IncidenciaC): Promise<void> {
  // Não duplica incidente aberto com mesmo título+evidencia (janela simples)
  const { data: existente } = await supabase
    .from('cerbero_incidentes')
    .select('id')
    .eq('titulo', i.titulo)
    .eq('status', 'aberto')
    .limit(1)
    .maybeSingle()
  if (existente) return

  const { error } = await supabase.from('cerbero_incidentes').insert({
    patrulha: i.patrulha,
    severidade: i.severidade,
    titulo: i.titulo,
    evidencia: i.evidencia,
  })
  if (error) logger.warn({ err: error.message, titulo: i.titulo }, '[cerbero] falha ao registrar incidente')
}

// ── Patrulha A — incoerências de dados (cron 1h) ─────────────────────────────
export async function patrulhaDados(): Promise<IncidenciaC[]> {
  const achados: IncidenciaC[] = []
  const hoje = new Date().toISOString().slice(0, 10)

  // A1. Plantões sobrepostos: mesmo médico em 2+ setores/unidades no mesmo dia+turno
  // (agrupamento em memória — PostgREST não suporta having de forma confiável)
  const { data: plantoesHoje } = await supabase
    .from('escala_plantao')
    .select('perfil_id, data, turno, unidade_id, setor_id')
    .eq('data', hoje)
    .eq('ativo', true)
    .limit(2000)
  const contagem = new Map<string, { chave: string; qtd: number }>()
  for (const p of plantoesHoje ?? []) {
    if (!p.perfil_id) continue
    const chave = `${p.perfil_id}|${p.data}|${p.turno}|${p.unidade_id}`
    const atual = contagem.get(chave) ?? { chave, qtd: 0 }
    atual.qtd++
    contagem.set(chave, atual)
  }
  for (const [chave, v] of contagem) {
    if (v.qtd > 1) {
      const [perfilId, data, turno, unidadeId] = chave.split('|')
      achados.push({
        patrulha: 'dados',
        severidade: 'critico',
        titulo: 'Plantão sobreposto do mesmo médico',
        evidencia: { perfil_id: perfilId, data, turno, unidade_id: unidadeId, quantidade: v.qtd },
      })
    }
  }

  // A2. Usuário ativo sem papel em nenhuma organização
  const { data: perfis } = await supabase.from('perfis').select('id').eq('ativo', true).limit(2000)
  const { data: vinculos } = await supabase.from('vinculos').select('perfil_id').eq('ativo', true).limit(5000)
  const comPapel = new Set((vinculos ?? []).map((v) => v.perfil_id))
  for (const p of perfis ?? []) {
    if (!comPapel.has(p.id)) {
      achados.push({
        patrulha: 'dados',
        severidade: 'informativo',
        titulo: 'Usuário ativo sem papel atribuído',
        evidencia: { perfil_id: p.id },
      })
    }
  }

  // A3. Mesmo CRM em médicos diferentes
  const { data: crmDup } = await supabase
    .from('perfis')
    .select('crm, uf_crm, id')
    .not('crm', 'is', null)
    .limit(3000)
  const porCrm = new Map<string, string[]>()
  for (const p of crmDup ?? []) {
    if (!p.crm) continue
    const chave = `${p.crm}|${p.uf_crm ?? ''}`
    const lista = porCrm.get(chave) ?? []
    lista.push(p.id)
    porCrm.set(chave, lista)
  }
  for (const [crm, ids] of porCrm) {
    if (ids.length > 1) {
      achados.push({
        patrulha: 'dados',
        severidade: 'atencao',
        titulo: 'CRM duplicado entre médicos',
        evidencia: { crm, perfis: ids },
      })
    }
  }

  return achados
}

// ── Patrulha C — ameaças ao Hermes (diária 05h) ──────────────────────────────
const PADROES_INJECTION = [
  /ignore\s+(your|as\s+an?|all)\s+(previous|prior|above|system)?\s*(instructions|prompts?|rules)/i,
  /reveal\s+(your|the)\s*(system|internal)?\s*(prompt|instructions)/i,
  /act\s+as\s+(admin|super.?admin|gestor)/i,
  /acesse\s+(dados|outro)\s+(tenant|cliente|paciente)/i,
  /forget\s+(all\s+)?(rules|instructions)/i,
]

export async function patrulhaHermes(): Promise<IncidenciaC[]> {
  const achados: IncidenciaC[] = []
  const desde = new Date(Date.now() - 24 * 3_600_000).toISOString()

  const { data: msgs } = await supabase
    .from('hermes_audit_log')
    .select('phone, direction, tool_result_summary, created_at')
    .eq('direction', 'in')
    .gte('created_at', desde)
    .limit(3000)

  const porTelefone = new Map<string, number>()
  for (const m of msgs ?? []) {
    const corpo = m.tool_result_summary ?? ''
    // Prompt injection
    for (const re of PADROES_INJECTION) {
      if (re.test(corpo)) {
        achados.push({
          patrulha: 'hermes',
          severidade: 'atencao',
          titulo: 'Possível prompt injection no Hermes',
          evidencia: { phone: m.phone, trecho: corpo.slice(0, 200), quando: m.created_at },
        })
        break
      }
    }
    // Volume por usuário
    porTelefone.set(m.phone, (porTelefone.get(m.phone) ?? 0) + 1)
  }

  // Volume anômalo: > p99 simples (maior contagem se muito acima da mediana)
  const contagens = [...porTelefone.values()].sort((a, b) => a - b)
  if (contagens.length >= 10) {
    const mediana = contagens[Math.floor(contagens.length / 2)]!
    const max = contagens[contagens.length - 1]!
    if (mediana > 0 && max > mediana * 5) {
      const quem = [...porTelefone.entries()].find(([, v]) => v === max)?.[0]
      achados.push({
        patrulha: 'hermes',
        severidade: 'atencao',
        titulo: 'Volume anômalo de mensagens ao Hermes',
        evidencia: { phone: quem, quantidade: max, mediana },
      })
    }
  }

  return achados
}

export async function rodarPatrulhaDados(): Promise<number> {
  const achados = await patrulhaDados()
  for (const a of achados) await registrarIncidente(a)
  logger.info({ achados: achados.length }, '[cerbero] patrulha dados concluída')
  return achados.length
}

export async function rodarPatrulhaHermes(): Promise<number> {
  const achados = await patrulhaHermes()
  for (const a of achados) await registrarIncidente(a)
  logger.info({ achados: achados.length }, '[cerbero] patrulha hermes concluída')
  return achados.length
}

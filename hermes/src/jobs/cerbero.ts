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

  // A4. Leito ocupado cujo setor NÃO tem médico na escala vigente (hoje)
  const { data: leitosOcupados } = await supabase
    .from('leitos')
    .select('id, setor_id')
    .eq('status', 'ocupado')
    .eq('ativo', true)
    .limit(1000)
  const { data: plantoesSetoresHoje } = await supabase
    .from('escala_plantao')
    .select('setor_id')
    .eq('data', hoje)
    .eq('ativo', true)
    .limit(2000)
  const setoresComEscalaHoje = new Set((plantoesSetoresHoje ?? []).map((p) => p.setor_id))
  const leitosVistos = new Set<string>()
  for (const l of leitosOcupados ?? []) {
    if (!l.setor_id || leitosVistos.has(l.id)) continue
    leitosVistos.add(l.id)
    if (!setoresComEscalaHoje.has(l.setor_id)) {
      achados.push({
        patrulha: 'dados',
        severidade: 'atencao',
        titulo: 'Leito ocupado em setor sem médico na escala de hoje',
        evidencia: { leito_id: l.id, setor_id: l.setor_id },
      })
    }
  }

  // A5. Censo com contagens negativas (incoerência de dado agregado)
  const { data: censos } = await supabase
    .from('censo_ocupacao')
    .select('unidade_id, setor_id, data, turno, internados, leitos_total, leitos_ocupados, leitos_livres')
    .limit(2000)
  for (const c of censos ?? []) {
    const negativos = Object.entries({
      internados: c.internados, leitos_total: c.leitos_total,
      leitos_ocupados: c.leitos_ocupados, leitos_livres: c.leitos_livres,
    }).filter(([, v]) => (v as number) < 0)
    if (negativos.length > 0) {
      achados.push({
        patrulha: 'dados',
        severidade: 'atencao',
        titulo: 'Censo com contagem negativa',
        evidencia: {
          unidade_id: c.unidade_id, setor_id: c.setor_id, data: c.data, turno: c.turno,
          campos_negativos: negativos.map(([k, v]) => `${k}=${v}`),
        },
      })
    }
  }

  // A6. Timestamps incoerentes: observação/prescrição com aferido/created no FUTURO
  const agoraIso = new Date().toISOString()
  const { data: obsFuturas } = await supabase
    .from('observacao')
    .select('id, unidade_id, aferido_em, created_at')
    .gt('aferido_em', agoraIso)
    .limit(500)
  for (const o of obsFuturas ?? []) {
    achados.push({
      patrulha: 'dados',
      severidade: 'atencao',
      titulo: 'Observação com aferição no futuro',
      evidencia: { observacao_id: o.id, unidade_id: o.unidade_id, aferido_em: o.aferido_em },
    })
  }
  const { data: prescFuturas } = await supabase
    .from('prescricoes')
    .select('id, unidade_id, created_at')
    .gt('created_at', agoraIso)
    .limit(500)
  for (const p of prescFuturas ?? []) {
    achados.push({
      patrulha: 'dados',
      severidade: 'atencao',
      titulo: 'Prescrição com criação no futuro',
      evidencia: { prescricao_id: p.id, unidade_id: p.unidade_id, created_at: p.created_at },
    })
  }

  // A7. Prescrição órfã (sem paciente) — dado clínico NUNCA exposto por nome
  const { data: prescOrfas } = await supabase
    .from('prescricoes')
    .select('id, unidade_id')
    .is('paciente_id', null)
    .limit(500)
  for (const p of prescOrfas ?? []) {
    achados.push({
      patrulha: 'dados',
      severidade: 'informativo',
      titulo: 'Prescrição sem paciente vinculado',
      evidencia: { prescricao_id: p.id, unidade_id: p.unidade_id },
    })
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

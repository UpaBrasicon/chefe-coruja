// ─────────────────────────────────────────────────────────────────────────────
// HERMES — jobs/cerbero.ts
// Cérbero — Patrulha A (incoerências de CADASTRO e ESCALA, cron 1h) e
// Patrulha C (ameaças ao Hermes, diária). SQL/TS puro, SEM LLM na detecção.
//
// Rodada B (27/09):
//   • as contas de escala e cadastro rodam no banco (hermes_* functions): janela
//     real do plantão, relógio do servidor, sem corte de 1000 linhas;
//   • "plantão sobreposto" = mesma pessoa em DUAS UNIDADES ao mesmo tempo
//     (vários setores da mesma unidade é legítimo — ADR 0003);
//   • dedup por chave (título + objeto), não só pelo título: um incidente
//     aberto não esconde mais os outros casos;
//   • checagens de dado CLÍNICO (observação/prescrição no futuro, prescrição
//     órfã, leito sem plantão) ficam só no Falcão (argos.ts) — antes cada
//     problema virava dois incidentes;
//   • erro de consulta derruba a patrulha (fica no log) em vez de virar
//     "nada encontrado";
//   • prompt injection em português também.
//
// ⚠️ Regra inviolável: reporta IDs e números, NUNCA nome de paciente.
// ─────────────────────────────────────────────────────────────────────────────
import { supabaseJob as supabase } from '../lib/supabase.js'
import { logger } from '../logger.js'
import { hojeBrasilia } from '../lib/tempo.js'
import { chavesJaAbertas, filtrarNovos } from './dedup.js'
import { PADROES_INJECTION } from './padroes-injection.js'

export type IncidenciaC = {
  patrulha: 'dados' | 'conteudo' | 'hermes'
  severidade: 'critico' | 'atencao' | 'informativo'
  titulo: string
  evidencia: Record<string, unknown>
  /** objeto do incidente (perfil, CRM, telefone…) — compõe a chave de dedup */
  objeto: string
}

export const chaveDedupCerbero = (i: IncidenciaC) => `${i.patrulha}:${i.titulo}:${i.objeto}`

function exigir<T>(r: { data: T | null; error: { message: string } | null }, contexto: string): T {
  if (r.error) throw new Error(`[cerbero] ${contexto}: ${r.error.message}`)
  return (r.data ?? ([] as unknown)) as T
}

async function registrar(achados: IncidenciaC[]): Promise<number> {
  if (achados.length === 0) return 0
  const abertas = await chavesJaAbertas(achados.map(chaveDedupCerbero))
  const novos = filtrarNovos(achados, chaveDedupCerbero, abertas)
  if (novos.length === 0) return 0
  const { error } = await supabase.from('cerbero_incidentes').insert(
    novos.map((i) => ({
      patrulha: i.patrulha,
      severidade: i.severidade,
      titulo: i.titulo,
      evidencia: i.evidencia,
      chave_dedup: chaveDedupCerbero(i),
    }))
  )
  if (error) throw new Error(`[cerbero] falha ao registrar incidentes: ${error.message}`)
  return novos.length
}

// ── Patrulha A — cadastro e escala (cron 1h) ────────────────────────────────
export async function patrulhaDados(): Promise<IncidenciaC[]> {
  const achados: IncidenciaC[] = []

  // A1. Mesma pessoa em duas unidades ao mesmo tempo (±24 h)
  type Sobreposto = { perfil_id: string; unidade_a: string; unidade_b: string; inicio_a: string; inicio_b: string }
  for (const s of exigir<Sobreposto[]>(await supabase.rpc('hermes_plantoes_sobrepostos', { p_horas: 24 }), 'sobrepostos')) {
    achados.push({
      patrulha: 'dados',
      severidade: 'critico',
      titulo: 'Plantão em duas unidades ao mesmo tempo',
      evidencia: s,
      objeto: `${s.perfil_id}:${s.inicio_a}:${s.inicio_b}`,
    })
  }

  // A2. Perfil ativo sem vínculo ativo
  for (const p of exigir<{ perfil_id: string }[]>(await supabase.rpc('hermes_perfis_sem_vinculo'), 'sem vínculo')) {
    achados.push({
      patrulha: 'dados',
      severidade: 'informativo',
      titulo: 'Usuário ativo sem papel atribuído',
      evidencia: { perfil_id: p.perfil_id },
      objeto: p.perfil_id,
    })
  }

  // A3. Mesmo CRM em perfis diferentes
  for (const c of exigir<{ crm: string; uf_crm: string; perfis: string[] }[]>(await supabase.rpc('hermes_crm_duplicado'), 'crm')) {
    achados.push({
      patrulha: 'dados',
      severidade: 'atencao',
      titulo: 'CRM duplicado entre médicos',
      evidencia: { crm: `${c.crm}/${c.uf_crm}`, perfis: c.perfis },
      objeto: `${c.crm}/${c.uf_crm}`,
    })
  }

  // A4. Censo com contagem negativa (últimos 7 dias)
  const desde = hojeBrasilia(-7)
  type Censo = { unidade_id: string; setor_id: string; data: string; turno: string; internados: number; leitos_total: number; leitos_ocupados: number; leitos_livres: number }
  const censos = exigir<Censo[]>(
    await supabase
      .from('censo_ocupacao')
      .select('unidade_id, setor_id, data, turno, internados, leitos_total, leitos_ocupados, leitos_livres')
      .gte('data', desde)
      .or('internados.lt.0,leitos_total.lt.0,leitos_ocupados.lt.0,leitos_livres.lt.0'),
    'censo'
  )
  for (const c of censos) {
    const negativos = Object.entries({
      internados: c.internados, leitos_total: c.leitos_total,
      leitos_ocupados: c.leitos_ocupados, leitos_livres: c.leitos_livres,
    }).filter(([, v]) => v < 0)
    achados.push({
      patrulha: 'dados',
      severidade: 'atencao',
      titulo: 'Censo com contagem negativa',
      evidencia: { unidade_id: c.unidade_id, setor_id: c.setor_id, data: c.data, turno: c.turno, campos_negativos: negativos.map(([k, v]) => `${k}=${v}`) },
      objeto: `${c.setor_id}:${c.data}:${c.turno}`,
    })
  }

  return achados
}

// ── Patrulha C — ameaças ao Hermes (diária 05h) ──────────────────────────────
export async function patrulhaHermes(): Promise<IncidenciaC[]> {
  const achados: IncidenciaC[] = []
  const desde = new Date(Date.now() - 24 * 3_600_000).toISOString()

  type Msg = { id: string; phone: string; tool_result_summary: string | null; created_at: string }
  const msgs = exigir<Msg[]>(
    await supabase
      .from('hermes_audit_log')
      .select('id, phone, tool_result_summary, created_at')
      .eq('direction', 'in')
      .gte('created_at', desde)
      .order('created_at', { ascending: false })
      .limit(1000),
    'audit log'
  )

  const porTelefone = new Map<string, number>()
  for (const m of msgs) {
    const corpo = m.tool_result_summary ?? ''
    if (PADROES_INJECTION.some((re) => re.test(corpo))) {
      achados.push({
        patrulha: 'hermes',
        severidade: 'atencao',
        titulo: 'Possível prompt injection no Hermes',
        // só o id da mensagem: o texto fica no log de origem, não é copiado
        evidencia: { audit_id: m.id, phone: m.phone, quando: m.created_at },
        objeto: m.id,
      })
    }
    porTelefone.set(m.phone, (porTelefone.get(m.phone) ?? 0) + 1)
  }

  // Volume anômalo: bem acima da mediana
  const contagens = [...porTelefone.values()].sort((a, b) => a - b)
  if (contagens.length >= 10) {
    const mediana = contagens[Math.floor(contagens.length / 2)]!
    const max = contagens[contagens.length - 1]!
    if (mediana > 0 && max > mediana * 5) {
      const quem = [...porTelefone.entries()].find(([, v]) => v === max)?.[0] ?? '?'
      achados.push({
        patrulha: 'hermes',
        severidade: 'atencao',
        titulo: 'Volume anômalo de mensagens ao Hermes',
        evidencia: { phone: quem, quantidade: max, mediana },
        objeto: `${quem}:${desde.slice(0, 10)}`,
      })
    }
  }
  return achados
}

export async function rodarPatrulhaDados(): Promise<number> {
  const achados = await patrulhaDados()
  const novos = await registrar(achados)
  logger.info({ achados: achados.length, novos }, '[cerbero] patrulha dados concluída')
  return achados.length
}

export async function rodarPatrulhaHermes(): Promise<number> {
  const achados = await patrulhaHermes()
  const novos = await registrar(achados)
  logger.info({ achados: achados.length, novos }, '[cerbero] patrulha hermes concluída')
  return achados.length
}

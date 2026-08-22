// ─────────────────────────────────────────────────────────────────────────────
// HERMES — server/skill-api.ts
// API das SKILLS da Corujinha/Nous (correção C1 da auditoria 22/08).
//
// PROBLEMA QUE ISTO RESOLVE
// Antes, cada skill era um script shell que falava direto com o Supabase REST
// usando a SERVICE_ROLE_KEY (bypassa RLS) e a autorização ("exclusivo
// super_admin", "só gestor/admin", "só a sua unidade") vivia apenas no texto
// do SKILL.md — ou seja, era o LLM quem decidia se podia ver o dado. Um erro
// do modelo ou um prompt injection bem-sucedido entregava incidentes e alertas
// de qualquer unidade.
//
// AGORA
// O script manda QUEM está perguntando (wa_id da sessão) e O QUE quer; o
// SERVIDOR resolve a identidade no banco, aplica a guarda de papel no código e
// só então consulta. O LLM não escolhe mais unidade nem papel:
//   • unidade_id vem SEMPRE do vínculo do usuário (nunca do argumento);
//   • pedir unidade fora dos vínculos = negado (anti cross-tenant);
//   • segurança/infra exigem `super_admins` (tabela, não afirmação);
//   • sentinela exige gestor/admin.
//
// LIMITE CONHECIDO (resíduo do C1, documentado em AUDITORIA):
// o `wa_id` chega do processo do Nous. Enquanto o Nous rodar com shell livre,
// um agente comprometido pode informar outro wa_id. O fechamento definitivo é
// o Nous passar um token de sessão opaco (emitido no início da conversa) em
// vez do wa_id — ver `resolverSujeito()`, que já aceita os dois formatos.
// O ganho imediato e real: a SERVICE_ROLE_KEY sai do ambiente das skills, e
// toda decisão de acesso passa a ser código auditável no servidor.
// ─────────────────────────────────────────────────────────────────────────────
import { createHash, timingSafeEqual } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { env } from '../config/env.js'
import { logger } from '../logger.js'
import { supabase } from '../lib/supabase.js'
import { resolverIdentidadePorWaId, type IdentidadeHermes } from '../agent/identidade.js'

/**
 * Resposta única para "não pode ver isto" — deliberadamente idêntica para
 * quem não tem papel, quem não existe e quem pediu outra unidade. Não revela
 * a existência das ferramentas internas (requisito do Cérbero).
 */
const RESPOSTA_GENERICA =
  'Não encontrei informações sobre esse assunto. Se precisar de ajuda com escala ou plantões, é só perguntar.'

export type EscopoSkill =
  | 'aguia'
  | 'garca'
  | 'operacional'
  | 'escala'
  | 'sentinela'
  | 'seguranca'
  | 'infra'

const ESCOPOS: EscopoSkill[] = [
  'aguia',
  'garca',
  'operacional',
  'escala',
  'sentinela',
  'seguranca',
  'infra',
]

/**
 * Papel mínimo exigido por escopo — a guarda que antes vivia no SKILL.md.
 * Exportada para teste: é a regra de acesso, precisa de cobertura direta.
 */
export function autorizado(escopo: EscopoSkill, id: IdentidadeHermes): boolean {
  switch (escopo) {
    case 'seguranca':
    case 'infra':
      return id.superAdmin === true
    case 'sentinela':
      return id.superAdmin === true || id.papel === 'gestor' || id.papel === 'admin'
    case 'aguia':
    case 'garca':
    case 'operacional':
    case 'escala':
      // Qualquer usuário com vínculo ativo. O recorte por papel dentro do
      // escopo (plantonista só vê os próprios plantões) é feito no handler.
      return id.papel !== null || id.superAdmin === true
    default:
      return false
  }
}

/** Comparação de token em tempo constante (evita timing oracle). */
function tokenValido(recebido: string | undefined, esperado: string): boolean {
  if (!recebido) return false
  // Hash antes de comparar: iguala o tamanho e não vaza o comprimento do token.
  const a = createHash('sha256').update(recebido).digest()
  const b = createHash('sha256').update(esperado).digest()
  return timingSafeEqual(a, b)
}

/**
 * Decide sobre QUAL unidade a consulta roda.
 * Regra: o argumento do LLM nunca manda — ele no máximo ESCOLHE entre as
 * unidades às quais o usuário já está vinculado. super_admin pode consultar
 * qualquer unidade (é suporte técnico global).
 */
export function resolverUnidade(
  id: IdentidadeHermes,
  pedida: string | undefined
): { ok: true; unidadeId: string | null } | { ok: false } {
  if (!pedida) return { ok: true, unidadeId: id.unidadeId }
  if (id.superAdmin === true) return { ok: true, unidadeId: pedida }
  const vinculado = id.vinculos.some((v) => v.unidadeId === pedida)
  if (!vinculado) return { ok: false }
  return { ok: true, unidadeId: pedida }
}

// ── Consultas por escopo ─────────────────────────────────────────────────────
// Cada handler recebe a unidade JÁ validada. Nenhum handler aceita filtro cru
// vindo do cliente: enums são conferidos aqui antes de virar query.

const STATUS_ALERTA = ['novo', 'visto', 'em_acompanhamento', 'justificado']
const PATRULHAS = ['dados', 'conteudo', 'hermes']
const SEVERIDADES = ['critico', 'atencao', 'informativo']
const STATUS_QUARENTENA = ['pendente', 'analisado', 'liberado']

function enumOuNulo(valor: unknown, permitidos: string[]): string | null {
  return typeof valor === 'string' && permitidos.includes(valor) ? valor : null
}

async function consultaAguia(comando: string, unidadeId: string | null): Promise<unknown> {
  if (!unidadeId) return { erro: 'usuário sem unidade vinculada' }

  switch (comando) {
    case 'setores': {
      const { data } = await supabase
        .from('setores')
        .select('nome')
        .eq('unidade_id', unidadeId)
        .eq('ativo', true)
        .order('ordem', { ascending: true })
      return data ?? []
    }
    case 'censo': {
      const { data } = await supabase
        .from('censo_ocupacao')
        .select('data, turno, internados, leitos_total, leitos_ocupados, leitos_livres, taxa_ocupacao')
        .eq('unidade_id', unidadeId)
        .order('data', { ascending: false })
        .order('turno', { ascending: true })
        .limit(6)
      return data ?? []
    }
    case 'indicadores': {
      const { data } = await supabase
        .from('vw_indicadores_unidade')
        .select('unidade_id, unidade_nome, total_pacientes, prescricoes_assinadas, prescricoes_rascunho, receitas_retidas')
        .eq('unidade_id', unidadeId)
      return data ?? []
    }
    case 'profissionais': {
      // A2 da auditoria: chat externo recebe só nome + papel. CRM/UF do CRM
      // é dado pessoal do profissional — fica na plataforma (LGPD). A
      // plataforma web não passa por aqui (consulta o Supabase com RLS).
      const { data } = await supabase
        .from('vinculos')
        .select('papel, perfis!vinculos_perfil_id_fkey(nome_completo)')
        .eq('unidade_id', unidadeId)
        .eq('ativo', true)
      return data ?? []
    }
    case 'resumo': {
      const [setores, censo, profissionais] = await Promise.all([
        consultaAguia('setores', unidadeId),
        consultaAguia('censo', unidadeId),
        consultaAguia('profissionais', unidadeId),
      ])
      const porPapel: Record<string, number> = {}
      for (const v of profissionais as { papel: string }[]) {
        porPapel[v.papel] = (porPapel[v.papel] ?? 0) + 1
      }
      return { setores, censo_recente: censo, profissionais_por_papel: porPapel }
    }
    default:
      return { erro: 'comando desconhecido' }
  }
}

async function consultaGarca(comando: string, unidadeId: string | null): Promise<unknown> {
  if (!unidadeId) return { erro: 'usuário sem unidade vinculada' }

  switch (comando) {
    case 'indicadores':
    case 'censo':
      return consultaAguia(comando, unidadeId)
    case 'internacoes': {
      // Só a CONTAGEM por status — nunca a lista de pacientes (LGPD).
      const { data } = await supabase
        .from('internacoes')
        .select('status')
        .eq('unidade_id', unidadeId)
        .limit(2000)
      const porStatus: Record<string, number> = {}
      for (const i of (data ?? []) as { status: string }[]) {
        porStatus[i.status] = (porStatus[i.status] ?? 0) + 1
      }
      return { por_status: porStatus, total: (data ?? []).length }
    }
    default:
      return { erro: 'comando desconhecido' }
  }
}

async function consultaSentinela(
  comando: string,
  unidadeId: string | null,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (comando) {
    case 'alertas': {
      const status = enumOuNulo(args.status, STATUS_ALERTA) ?? 'novo'
      let q = supabase
        .from('chronos_alertas_escala')
        .select('id, unidade_id, medico_id, metrica, valor, mediana_unidade, limite_outlier, status, criado_em')
        .eq('status', status)
        .order('criado_em', { ascending: false })
        .limit(25)
      // Gestor/admin veem só a própria unidade. super_admin sem unidade vê tudo.
      if (unidadeId) q = q.eq('unidade_id', unidadeId)
      const { data } = await q
      return data ?? []
    }
    case 'relatorio': {
      const { data } = await supabase
        .from('gaviao_relatorios_semanais')
        .select('periodo_inicio, periodo_fim, resumo, gerado_em')
        .order('periodo_inicio', { ascending: false })
        .limit(1)
      return data ?? []
    }
    default:
      return { erro: 'comando desconhecido' }
  }
}

async function consultaSeguranca(comando: string, args: Record<string, unknown>): Promise<unknown> {
  switch (comando) {
    case 'incidentes': {
      let q = supabase
        .from('cerbero_incidentes')
        .select('id, patrulha, severidade, titulo, status, detectado_em')
        .in('status', ['aberto', 'em_analise'])
        .order('detectado_em', { ascending: false })
        .limit(25)
      const patrulha = enumOuNulo(args.patrulha, PATRULHAS)
      const severidade = enumOuNulo(args.severidade, SEVERIDADES)
      if (patrulha) q = q.eq('patrulha', patrulha)
      if (severidade) q = q.eq('severidade', severidade)
      const { data } = await q
      return data ?? []
    }
    case 'quarentena': {
      let q = supabase
        .from('cerbero_quarentena')
        .select('id, tipo, origem, motivo, liberado, criado_em')
        .eq('liberado', false)
        .order('criado_em', { ascending: false })
        .limit(25)
      const status = enumOuNulo(args.status, STATUS_QUARENTENA)
      if (status) q = q.eq('status', status)
      const { data } = await q
      return data ?? []
    }
    default:
      return { erro: 'comando desconhecido' }
  }
}

async function consultaOperacional(
  comando: string,
  unidadeId: string | null,
  args: Record<string, unknown>
): Promise<unknown> {
  if (!unidadeId) return { erro: 'usuário sem unidade vinculada' }

  switch (comando) {
    case 'setores':
    case 'censo':
    case 'indicadores':
    case 'profissionais':
      return consultaAguia(comando, unidadeId)
    case 'notificacoes': {
      const dias = Number(args.dias)
      const janela = Number.isFinite(dias) && dias > 0 && dias <= 90 ? dias : 7
      const desde = new Date(Date.now() - janela * 86_400_000).toISOString().slice(0, 10)
      const { data } = await supabase
        .from('notificacoes_plantonista')
        .select('tipo, mensagem, data')
        .eq('unidade_id', unidadeId)
        .gte('data', desde)
        .order('data', { ascending: false })
        .limit(50)
      return data ?? []
    }
    default:
      return { erro: 'comando desconhecido' }
  }
}

/**
 * Escala. Aqui mora a guarda que mais importa no dia a dia:
 * `meus_plantoes` usa SEMPRE o perfil da sessão. O script antigo recebia o
 * perfil_id por argumento — ou seja, bastava o agente passar outro id para ler
 * a escala de qualquer médico.
 */
async function consultaEscala(
  comando: string,
  id: IdentidadeHermes,
  unidadeId: string | null,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (comando) {
    case 'meus_plantoes': {
      const periodo = enumOuNulo(args.periodo, ['hoje', 'semana', 'mes']) ?? 'semana'
      const hoje = new Date()
      const fim = new Date(hoje)
      if (periodo === 'mes') fim.setMonth(hoje.getMonth() + 1)
      else if (periodo === 'semana') fim.setDate(hoje.getDate() + 7)

      const { data } = await supabase
        .from('escala_plantao')
        .select('data, turno, rotulo, setores!escala_plantao_setor_id_fkey(nome)')
        .eq('perfil_id', id.perfilId) // ← nunca o que veio no argumento
        .eq('ativo', true)
        .gte('data', hoje.toISOString().slice(0, 10))
        .lte('data', fim.toISOString().slice(0, 10))
        .order('data', { ascending: true })
        .order('turno', { ascending: true })
      return data ?? []
    }
    case 'plantao_do_dia': {
      // Escala de toda a unidade: só gestor/admin (ou suporte global).
      if (!(id.superAdmin === true || id.papel === 'gestor' || id.papel === 'admin')) {
        return { mensagem: 'Posso mostrar apenas os seus próprios plantões.' }
      }
      if (!unidadeId) return { erro: 'usuário sem unidade vinculada' }
      const data = typeof args.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.data)
        ? args.data
        : new Date().toISOString().slice(0, 10)
      const { data: plantoes } = await supabase
        .from('escala_plantao')
        .select('data, turno, rotulo, perfis!escala_plantao_perfil_id_fkey(nome_completo), setores!escala_plantao_setor_id_fkey(nome)')
        .eq('unidade_id', unidadeId)
        .eq('data', data)
        .eq('ativo', true)
        .order('turno', { ascending: true })
      return plantoes ?? []
    }
    default:
      return { erro: 'comando desconhecido' }
  }
}

/**
 * Infra (super_admin): panorama de integridade sem expor conteúdo. Só
 * contagens — nunca títulos de incidente, que podem carregar texto de origem.
 */
async function consultaInfra(comando: string): Promise<unknown> {
  if (comando !== 'integridade') return { erro: 'comando desconhecido' }

  const [incidentes, quarentena] = await Promise.all([
    supabase.from('cerbero_incidentes').select('severidade').in('status', ['aberto', 'em_analise']).limit(500),
    supabase.from('cerbero_quarentena').select('id').eq('liberado', false).limit(500),
  ])

  const porSeveridade: Record<string, number> = { critico: 0, atencao: 0, informativo: 0 }
  for (const i of (incidentes.data ?? []) as { severidade: string }[]) {
    porSeveridade[i.severidade] = (porSeveridade[i.severidade] ?? 0) + 1
  }
  return {
    incidentes_abertos: (incidentes.data ?? []).length,
    por_severidade: porSeveridade,
    quarentena_pendente: (quarentena.data ?? []).length,
  }
}

/**
 * Resolve o sujeito da consulta. Aceita `wa_id` (telefone da sessão do Nous).
 * O formato de token opaco de sessão entra aqui quando o Nous suportar — a
 * assinatura já prevê o ponto de extensão.
 */
async function resolverSujeito(waId: string): Promise<IdentidadeHermes | null> {
  return resolverIdentidadePorWaId(waId)
}

type CorpoSkill = {
  wa_id?: string
  escopo?: string
  comando?: string
  args?: Record<string, unknown>
}

export function registrarSkillApi(app: FastifyInstance): void {
  app.post('/skill/consulta', async (req, reply) => {
    const token = env.SKILL_API_TOKEN
    if (!token) {
      // Falha fechada: sem token configurado a API não atende.
      logger.error('[skill-api] SKILL_API_TOKEN não configurado — rota desabilitada')
      return reply.code(503).send({ ok: false, erro: 'skill api não configurada' })
    }

    if (!tokenValido(req.headers['x-skill-token'] as string | undefined, token)) {
      logger.warn({ ip: req.ip }, '[skill-api] token inválido')
      return reply.code(401).send({ ok: false, erro: 'não autorizado' })
    }

    const corpo = (req.body ?? {}) as CorpoSkill
    const escopo = corpo.escopo as EscopoSkill
    const comando = typeof corpo.comando === 'string' ? corpo.comando : ''
    const args = (corpo.args ?? {}) as Record<string, unknown>

    if (!ESCOPOS.includes(escopo) || !/^[a-z_]{1,32}$/.test(comando)) {
      return reply.code(400).send({ ok: false, erro: 'escopo ou comando inválido' })
    }
    if (typeof corpo.wa_id !== 'string' || corpo.wa_id.length === 0) {
      return reply.code(400).send({ ok: false, erro: 'wa_id obrigatório' })
    }

    let identidade: IdentidadeHermes | null
    try {
      identidade = await resolverSujeito(corpo.wa_id)
    } catch (err) {
      logger.error({ err: (err as Error).message }, '[skill-api] falha ao resolver identidade')
      return reply.code(500).send({ ok: false, erro: 'falha interna' })
    }

    // Desconhecido, sem papel ou sem privilégio → MESMA resposta genérica.
    if (!identidade || !autorizado(escopo, identidade)) {
      logger.warn(
        { escopo, comando, perfil: identidade?.perfilId ?? null, papel: identidade?.papel ?? null },
        '[skill-api] acesso negado'
      )
      return reply.code(403).send({ ok: false, erro: 'nao_autorizado', resposta: RESPOSTA_GENERICA })
    }

    const unidade = resolverUnidade(identidade, typeof args.unidade_id === 'string' ? args.unidade_id : undefined)
    if (!unidade.ok) {
      // Pediu unidade à qual não está vinculado — cross-tenant. Registra como
      // incidente: é exatamente o que o Gavião deve enxergar.
      logger.warn(
        { escopo, perfil: identidade.perfilId, pedida: args.unidade_id },
        '[skill-api] tentativa cross-tenant bloqueada'
      )
      await supabase.from('cerbero_incidentes').insert({
        patrulha: 'hermes',
        severidade: 'atencao',
        titulo: '[SkillAPI] Tentativa de acesso a unidade não vinculada',
        evidencia: { perfil_id: identidade.perfilId, escopo, unidade_pedida: args.unidade_id },
      })
      return reply.code(403).send({ ok: false, erro: 'nao_autorizado', resposta: RESPOSTA_GENERICA })
    }

    try {
      let dados: unknown
      switch (escopo) {
        case 'aguia':
          dados = await consultaAguia(comando, unidade.unidadeId)
          break
        case 'garca':
          dados = await consultaGarca(comando, unidade.unidadeId)
          break
        case 'operacional':
          dados = await consultaOperacional(comando, unidade.unidadeId, args)
          break
        case 'escala':
          dados = await consultaEscala(comando, identidade, unidade.unidadeId, args)
          break
        case 'sentinela':
          dados = await consultaSentinela(comando, unidade.unidadeId, args)
          break
        case 'seguranca':
          dados = await consultaSeguranca(comando, args)
          break
        case 'infra':
          dados = await consultaInfra(comando)
          break
      }
      return reply.code(200).send({ ok: true, dados })
    } catch (err) {
      logger.error({ err: (err as Error).message, escopo, comando }, '[skill-api] falha na consulta')
      return reply.code(500).send({ ok: false, erro: 'falha interna' })
    }
  })
}

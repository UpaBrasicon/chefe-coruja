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
import { hojeBrasilia } from '../lib/tempo.js'
import { supabaseUser } from '../lib/supabase.js'
import {
  resolverIdentidadePorCanal,
  resolverIdentidadePorWaId,
  type CanalHermes,
  type IdentidadeHermes,
} from '../agent/identidade.js'
import { criarCofre, desidentificar, type Conhecido } from '../gateway/desidentificacao.js'

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
/** Papel mais forte que a pessoa tem NAQUELA unidade. */
export function papelNaUnidade(id: IdentidadeHermes, unidadeId: string): IdentidadeHermes['papel'] {
  const ordem = ['admin', 'gestor', 'plantonista', 'enfermeiro', 'telemedicina', 'farmaceutico', 'tecnico_enfermagem', 'recepcao']
  const papeis = id.vinculos.filter((v) => v.unidadeId === unidadeId).map((v) => v.papel)
  return (ordem.find((p) => papeis.includes(p as never)) as IdentidadeHermes['papel']) ?? null
}

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

/** Nomes das pessoas com vínculo na unidade — o que o gateway deve trocar por pseudônimo. */
async function nomesDaUnidade(perfil: string, unidadeId: string): Promise<Conhecido[]> {
  // RETURNS TABLE(nome_completo) → array. A RPC exige vínculo do chamador.
  const linhas = dados<{ nome_completo: string }[]>(
    await supabaseUser.rpc('hermes_unidade_nomes', { p_perfil: perfil, p_unidade: unidadeId })
  )
  return linhas.map((p) => ({ valor: p.nome_completo, categoria: 'PESSOA' as const }))
}

// ── Consultas por escopo ─────────────────────────────────────────────────────
// Cada handler recebe a unidade JÁ validada. Nenhum handler aceita filtro cru
// vindo do cliente: enums são conferidos aqui antes de virar query.

const STATUS_ALERTA = ['novo', 'visto', 'em_acompanhamento', 'justificado']
const PATRULHAS = ['dados', 'conteudo', 'hermes']
const SEVERIDADES = ['critico', 'atencao', 'informativo']

/** Erro de consulta vira falha (500 no log), nunca "não encontrei nada". */
function dados<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message)
  return (r.data ?? ([] as unknown)) as T
}

function enumOuNulo(valor: unknown, permitidos: string[]): string | null {
  return typeof valor === 'string' && permitidos.includes(valor) ? valor : null
}

async function consultaAguia(comando: string, perfil: string, unidadeId: string | null): Promise<unknown> {
  if (!unidadeId) return { erro: 'usuário sem unidade vinculada' }

  switch (comando) {
    case 'setores': {
      // RETURNS TABLE(nome) → array {nome} (igual ao select antigo).
      return dados(await supabaseUser.rpc('hermes_unidade_setores', { p_perfil: perfil, p_unidade: unidadeId }))
    }
    case 'censo': {
      // RETURNS TABLE(...) → array. A RPC devolve a leitura mais recente (1),
      // onde o select antigo trazia até 6.
      return dados(await supabaseUser.rpc('hermes_unidade_censo', { p_perfil: perfil, p_unidade: unidadeId }))
    }
    case 'indicadores': {
      // RETURNS TABLE(total_pacientes, prescricoes_assinadas, prescricoes_rascunho,
      // receitas_retidas) → array de uma linha (sem unidade_id/unidade_nome).
      return dados(await supabaseUser.rpc('hermes_unidade_indicadores', { p_perfil: perfil, p_unidade: unidadeId }))
    }
    case 'profissionais': {
      // Só a CONTAGEM por papel. Nome de colega é dado pessoal e iria ao
      // modelo de IA sem passar pelo gateway (ADR 0006, auditoria 27/09):
      // quem precisa da lista nominal usa a plataforma.
      // RETURNS TABLE(papel, total) → remonta o Record<papel, contagem>.
      const linhas = dados<{ papel: string; total: number }[]>(
        await supabaseUser.rpc('hermes_unidade_profissionais', { p_perfil: perfil, p_unidade: unidadeId })
      )
      const porPapel: Record<string, number> = {}
      for (const l of linhas) porPapel[l.papel] = Number(l.total)
      return { profissionais_por_papel: porPapel }
    }
    case 'resumo': {
      // Uma linha pronta por unidade, refeita a cada 15 min pelo banco
      // (private.hermes_atualizar_resumos) — uma leitura em vez de várias.
      // RETURNS jsonb (escalar): o próprio `dados`, ou null se ainda não gerado.
      const { data, error } = await supabaseUser.rpc('hermes_unidade_resumo', { p_perfil: perfil, p_unidade: unidadeId })
      if (error) throw new Error(error.message)
      return data ?? { mensagem: 'Resumo ainda não gerado para esta unidade.' }
    }
    default:
      return { erro: 'comando desconhecido' }
  }
}

async function consultaGarca(comando: string, perfil: string, unidadeId: string | null): Promise<unknown> {
  if (!unidadeId) return { erro: 'usuário sem unidade vinculada' }

  switch (comando) {
    case 'indicadores':
    case 'censo':
      return consultaAguia(comando, perfil, unidadeId)
    case 'internacoes': {
      // Só a CONTAGEM por status — nunca a lista de pacientes (LGPD). A RPC já
      // agrega no banco (RETURNS TABLE(status, total)); remontamos o Record e o
      // total — a paginação de 1000 no cliente sai.
      const linhas = dados<{ status: string; total: number }[]>(
        await supabaseUser.rpc('hermes_unidade_internacoes_por_status', { p_perfil: perfil, p_unidade: unidadeId })
      )
      const porStatus: Record<string, number> = {}
      let total = 0
      for (const l of linhas) {
        const n = Number(l.total)
        porStatus[l.status] = n
        total += n
      }
      return { por_status: porStatus, total }
    }
    default:
      return { erro: 'comando desconhecido' }
  }
}

async function consultaSentinela(
  comando: string,
  perfil: string,
  unidadeId: string | null,
  args: Record<string, unknown>,
  superAdmin: boolean
): Promise<unknown> {
  switch (comando) {
    case 'alertas': {
      // A RPC recebe p_status como array; preservamos o filtro por um status
      // (default 'novo'). unidadeId null + super → todas as unidades.
      // RETURNS TABLE(...) → array (sem `limite_outlier`; sem LIMIT 25 fixo).
      const status = enumOuNulo(args.status, STATUS_ALERTA) ?? 'novo'
      return dados(await supabaseUser.rpc('hermes_alertas_escala', {
        p_perfil: perfil,
        p_unidade: unidadeId,
        p_status: [status],
      }))
    }
    case 'relatorio': {
      // O relatório é GLOBAL (todas as organizações): só suporte técnico.
      if (!superAdmin) return { mensagem: 'O relatório semanal é consultado na plataforma.' }
      // RETURNS jsonb (escalar) = a linha mais recente, ou null. Mantemos o
      // shape de "lista" (0 ou 1) que o select .limit(1) antigo entregava.
      const { data, error } = await supabaseUser.rpc('hermes_relatorio_semanal_ultimo', { p_perfil: perfil })
      if (error) throw new Error(error.message)
      return data ? [data] : []
    }
    default:
      return { erro: 'comando desconhecido' }
  }
}

async function consultaSeguranca(comando: string, perfil: string, args: Record<string, unknown>): Promise<unknown> {
  switch (comando) {
    case 'incidentes': {
      // RETURNS TABLE(...) → array; a RPC já filtra status aberto/em_analise e
      // aceita patrulha/severidade opcionais (null = sem filtro).
      const patrulha = enumOuNulo(args.patrulha, PATRULHAS)
      const severidade = enumOuNulo(args.severidade, SEVERIDADES)
      return dados(await supabaseUser.rpc('hermes_incidentes_abertos', {
        p_perfil: perfil,
        p_patrulha: patrulha,
        p_severidade: severidade,
      }))
    }
    case 'quarentena': {
      // RETURNS TABLE(id, tipo, origem, motivo, criado_em) → array (sem
      // `liberado`, que era sempre false aqui).
      return dados(await supabaseUser.rpc('hermes_quarentena_pendente', { p_perfil: perfil }))
    }
    default:
      return { erro: 'comando desconhecido' }
  }
}

async function consultaOperacional(
  comando: string,
  unidadeId: string | null,
  args: Record<string, unknown>,
  id: IdentidadeHermes
): Promise<unknown> {
  if (!unidadeId) return { erro: 'usuário sem unidade vinculada' }

  switch (comando) {
    case 'setores':
    case 'censo':
    case 'indicadores':
    case 'profissionais':
      return consultaAguia(comando, id.perfilId, unidadeId)
    case 'notificacoes': {
      const dias = Number(args.dias)
      const janela = Number.isFinite(dias) && dias > 0 && dias <= 90 ? dias : 7
      // A RPC filtra pelo próprio perfil + unidade + janela de dias dentro do
      // SQL. RETURNS TABLE(tipo, mensagem, data) → array.
      const linhas = dados<{ tipo: string; mensagem: string; data: string }[]>(
        await supabaseUser.rpc('hermes_minhas_notificacoes', {
          p_perfil: id.perfilId,
          p_unidade: unidadeId,
          p_dias: janela,
        })
      )
      // Avisos como o do Sentinela citam colegas pelo nome: o texto passa
      // pelo gateway de desidentificação antes de ir ao modelo (ADR 0006).
      const conhecidos = await nomesDaUnidade(id.perfilId, unidadeId)
      const cofre = criarCofre()
      return linhas.map((n) => ({
        ...n,
        mensagem: desidentificar(n.mensagem ?? '', cofre, conhecidos).texto,
      }))
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
      // Janela real do plantão (início + duração), em horário de Brasília,
      // incluindo o plantão em curso que começou ontem.
      return dados(await supabaseUser.rpc('hermes_plantoes_do_perfil', {
        p_perfil: id.perfilId, // ← nunca o que veio no argumento
        p_dias: periodo === 'hoje' ? 1 : periodo === 'semana' ? 7 : 31,
      }))
    }
    case 'plantao_do_dia': {
      // Escala de toda a unidade: só gestor/admin (ou suporte global).
      if (!(id.superAdmin === true || id.papel === 'gestor' || id.papel === 'admin')) {
        return { mensagem: 'Posso mostrar apenas os seus próprios plantões.' }
      }
      if (!unidadeId) return { erro: 'usuário sem unidade vinculada' }
      const dia = typeof args.data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(args.data) ? args.data : hojeBrasilia()
      // Contagem por setor e horário de início — sem nomes (ADR 0006; a
      // escala nominal fica na plataforma).
      const linhas = dados(await supabaseUser.rpc('hermes_plantao_do_dia', { p_unidade: unidadeId, p_dia: dia }))
      return { dia, plantoes: linhas }
    }
    default:
      return { erro: 'comando desconhecido' }
  }
}

/**
 * Infra (super_admin): panorama de integridade sem expor conteúdo. Só
 * contagens — nunca títulos de incidente, que podem carregar texto de origem.
 */
async function consultaInfra(comando: string, perfil: string): Promise<unknown> {
  if (comando !== 'integridade') return { erro: 'comando desconhecido' }

  // RETURNS jsonb (escalar) = { incidentes_abertos, quarentena_pendente }. A
  // RPC NÃO traz a quebra por_severidade que o cliente montava antes.
  const { data, error } = await supabaseUser.rpc('hermes_integridade_resumo', { p_perfil: perfil })
  if (error) throw new Error(error.message)
  return data ?? { incidentes_abertos: 0, quarentena_pendente: 0 }
}

/**
 * Resolve o sujeito da consulta. Aceita `wa_id` (telefone da sessão do Nous).
 * O formato de token opaco de sessão entra aqui quando o Nous suportar — a
 * assinatura já prevê o ponto de extensão.
 */
async function resolverSujeito(corpo: CorpoSkill): Promise<IdentidadeHermes | null> {
  if (corpo.canal) return resolverIdentidadePorCanal(corpo.canal, String(corpo.identificador ?? ''))
  return resolverIdentidadePorWaId(String(corpo.wa_id ?? ''))
}

const CANAIS: CanalHermes[] = ['telegram', 'whatsapp']

type CorpoSkill = {
  wa_id?: string
  /** Canal com vínculo por código (Telegram): identificador vem da sessão do canal. */
  canal?: CanalHermes
  identificador?: string
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

    if ((!ESCOPOS.includes(escopo) && corpo.escopo !== 'almanaque') || !/^[a-z_]{1,32}$/.test(comando)) {
      return reply.code(400).send({ ok: false, erro: 'escopo ou comando inválido' })
    }
    // Almanaque: como usar a plataforma. Não depende de quem pergunta (serve
    // até antes do vínculo — "como conecto o Telegram?").
    if (corpo.escopo === 'almanaque') {
      const texto = typeof args.texto === 'string' ? args.texto.slice(0, 300) : ''
      if (comando !== 'buscar' || texto.trim().length < 3) {
        return reply.code(400).send({ ok: false, erro: 'informe a pergunta' })
      }
      try {
        const achados = dados(await supabaseUser.rpc('hermes_almanaque_buscar', { p_texto: texto, p_limite: 2 }))
        return reply.code(200).send({ ok: true, dados: achados })
      } catch (err) {
        logger.error({ err: (err as Error).message }, '[skill-api] falha no almanaque')
        return reply.code(500).send({ ok: false, erro: 'falha interna' })
      }
    }

    const temCanal = typeof corpo.canal === 'string'
    if (temCanal ? !CANAIS.includes(corpo.canal!) || typeof corpo.identificador !== 'string' || !corpo.identificador
                 : typeof corpo.wa_id !== 'string' || corpo.wa_id.length === 0) {
      return reply.code(400).send({ ok: false, erro: 'sujeito obrigatório (wa_id ou canal+identificador)' })
    }

    let identidade: IdentidadeHermes | null
    try {
      identidade = await resolverSujeito(corpo)
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
    // O papel que vale é o da unidade consultada: gestor em A e plantonista em
    // B não consulta B com poder de gestor (auditoria 27/09).
    if (unidade.ok && unidade.unidadeId && unidade.unidadeId !== identidade.unidadeId) {
      identidade = { ...identidade, papel: papelNaUnidade(identidade, unidade.unidadeId), unidadeId: unidade.unidadeId }
    }
    if (!unidade.ok) {
      // Pediu unidade à qual não está vinculado — cross-tenant. Sob hermes_user
      // (sem grant de tabela) o registro vai pelo audit_log via RPC, não mais
      // por INSERT direto em cerbero_incidentes.
      logger.warn(
        { escopo, perfil: identidade.perfilId, pedida: args.unidade_id },
        '[skill-api] tentativa cross-tenant bloqueada'
      )
      await supabaseUser.rpc('hermes_audit_registrar', {
        p_perfil: identidade.perfilId,
        p_phone: corpo.wa_id ?? corpo.identificador ?? '',
        p_direction: 'tool',
        p_tool_name: 'skill_cross_tenant_bloqueado',
        p_tool_args: { escopo, unidade_pedida: args.unidade_id },
        p_resumo: '[SkillAPI] Tentativa de acesso a unidade não vinculada',
      })
      return reply.code(403).send({ ok: false, erro: 'nao_autorizado', resposta: RESPOSTA_GENERICA })
    }

    try {
      let dados: unknown
      switch (escopo) {
        case 'aguia':
          dados = await consultaAguia(comando, identidade.perfilId, unidade.unidadeId)
          break
        case 'garca':
          dados = await consultaGarca(comando, identidade.perfilId, unidade.unidadeId)
          break
        case 'operacional':
          dados = await consultaOperacional(comando, unidade.unidadeId, args, identidade)
          break
        case 'escala':
          dados = await consultaEscala(comando, identidade, unidade.unidadeId, args)
          break
        case 'sentinela':
          dados = await consultaSentinela(comando, identidade.perfilId, unidade.unidadeId, args, identidade.superAdmin === true)
          break
        case 'seguranca':
          dados = await consultaSeguranca(comando, identidade.perfilId, args)
          break
        case 'infra':
          dados = await consultaInfra(comando, identidade.perfilId)
          break
      }
      return reply.code(200).send({ ok: true, dados })
    } catch (err) {
      logger.error({ err: (err as Error).message, escopo, comando }, '[skill-api] falha na consulta')
      return reply.code(500).send({ ok: false, erro: 'falha interna' })
    }
  })

  // ── POST /skill/vincular — liga o usuário do canal (Telegram) ao perfil ───
  // O código de 6 dígitos foi gerado pela própria pessoa, logada na
  // plataforma (gerar_codigo_vinculo_hermes). O identificador do canal vem da
  // SESSÃO do Nous, não do modelo. Até 5 tentativas erradas por
  // identificador a cada 15 minutos.
  app.post('/skill/vincular', async (req, reply) => {
    const token = env.SKILL_API_TOKEN
    if (!token) return reply.code(503).send({ ok: false, erro: 'skill api não configurada' })
    if (!tokenValido(req.headers['x-skill-token'] as string | undefined, token)) {
      logger.warn({ ip: req.ip }, '[skill-api] token inválido (vincular)')
      return reply.code(401).send({ ok: false, erro: 'não autorizado' })
    }
    const corpo = (req.body ?? {}) as { canal?: string; identificador?: string; codigo?: string }
    const canal = corpo.canal as CanalHermes
    const identificador = typeof corpo.identificador === 'string' ? corpo.identificador : ''
    const codigo = typeof corpo.codigo === 'string' ? corpo.codigo.replace(/\D/g, '') : ''
    if (!CANAIS.includes(canal) || !/^[A-Za-z0-9_.:-]{1,64}$/.test(identificador) || codigo.length !== 6) {
      return reply.code(400).send({ ok: false, erro: 'código inválido' })
    }

    const chave = `${canal}:${identificador}`
    const agora = Date.now()
    const tentativas = (TENTATIVAS_VINCULO.get(chave) ?? []).filter((t) => agora - t < 15 * 60_000)
    if (tentativas.length >= 5) {
      return reply.code(429).send({ ok: false, erro: 'Muitas tentativas. Gere um código novo e tente em 15 minutos.' })
    }

    // confirmar_vinculo_hermes: EXECUTE para hermes_user (20261020000002,
    // reafirmado em 20261022000007) e na allowlist RPC_USUARIO.
    const { data: perfilId, error } = await supabaseUser.rpc('confirmar_vinculo_hermes', {
      p_canal: canal,
      p_identificador: identificador,
      p_codigo: codigo,
    })
    if (error) {
      logger.error({ err: error.message }, '[skill-api] falha ao confirmar vínculo')
      return reply.code(500).send({ ok: false, erro: 'falha interna' })
    }
    if (!perfilId) {
      TENTATIVAS_VINCULO.set(chave, [...tentativas, agora])
      return reply.code(200).send({ ok: false, erro: 'Código errado, vencido ou já usado. Gere um novo no seu Perfil.' })
    }
    TENTATIVAS_VINCULO.delete(chave)
    const identidade = await resolverIdentidadePorCanal(canal, identificador)
    logger.info({ canal, perfil: perfilId }, '[skill-api] canal vinculado')
    return reply.code(200).send({ ok: true, nome: identidade?.nome ?? null, papel: identidade?.papel ?? null })
  })
}

/** Tentativas de código erradas por canal:identificador (memória do processo). */
const TENTATIVAS_VINCULO = new Map<string, number[]>()

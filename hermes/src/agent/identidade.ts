// ─────────────────────────────────────────────────────────────────────────────
// HERMES — agent/identidade.ts
// Resolução de identidade: wa_id (telefone da Meta) → perfil do Chefe Coruja.
//
// ⚠️ REGRA 3 (regras transversais): chamadas com service_role BYPASSAM o RLS.
// A camada de tools é responsável por reimplementar o filtro de papel/unidade
// no código. Aqui resolvemos APENAS o perfil + vínculos do dono do telefone —
// nenhum dado de outro usuário é lido.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js'
import { normalizarE164BR, telefoneCorrespondeWaId } from '../lib/telefone.js'
import { logger } from '../logger.js'

export type PapelHermes = 'gestor' | 'plantonista' | 'admin'

/** Precedência para escolher o vínculo principal quando há mais de um. */
const PRECEDENCIA_PAPEL: Record<PapelHermes, number> = {
  admin: 3,
  gestor: 2,
  plantonista: 1,
}

export type VinculoHermes = {
  papel: PapelHermes
  unidadeId: string
  unidadeNome: string
  organizacaoId: string
}

export type IdentidadeHermes = {
  perfilId: string
  nome: string
  email: string | null
  papel: PapelHermes | null
  unidadeId: string | null
  unidadeNome: string | null
  /** user_id da organização (usado para conferir org de teste etc.) */
  organizacaoId: string | null
  /** TODOS os vínculos ativos — usado para validar a unidade pedida (anti cross-tenant). */
  vinculos: VinculoHermes[]
  /**
   * Suporte técnico global (tabela `super_admins`). É a ÚNICA fonte de verdade
   * para as guardas "exclusivo super_admin" (Cérbero/segurança, infraestrutura).
   * Nunca inferir de `papel` nem do que o usuário afirma ser na conversa.
   */
  superAdmin: boolean
}

/**
 * Verifica se o perfil está na tabela `super_admins`. Fonte única — as guardas
 * de papel do backend e das skills dependem disto, nunca do texto da conversa.
 */
export async function ehSuperAdmin(perfilId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('super_admins')
    .select('perfil_id')
    .eq('perfil_id', perfilId)
    .maybeSingle()

  if (error) {
    // Falha fechada: erro ao consultar NUNCA concede privilégio.
    logger.error({ err: error.message, perfil: perfilId }, '[identidade] falha ao checar super_admin')
    return false
  }
  return Boolean(data)
}

/**
 * Busca o perfil cujo telefone corresponde ao wa_id (E.164 normalizado).
 * Retorna null quando o número não está cadastrado.
 *
 * Estratégia: tenta primeiro uma consulta DIRETA por E.164 completo (caso
 * comum e barato). Se não achar, faz um scan limitado tolerante a formatos
 * (fallback para telefones armazenados em formato não-normalizado).
 */
export async function resolverIdentidadePorWaId(waId: string): Promise<IdentidadeHermes | null> {
  // 1) Normaliza o wa_id e busca direta por E.164 completo (caso comum).
  const e164 = normalizarE164BR(waId)

  let perfil: { id: string; nome_completo: string; email: string | null; telefone: string | null } | null =
    null

  if (e164) {
    const { data: direto, error: errDireto } = await supabase
      .from('perfis')
      .select('id, nome_completo, email, telefone')
      .eq('telefone', e164)
      .eq('ativo', true)
      .limit(1)
      .maybeSingle()
    if (errDireto) {
      logger.error({ err: errDireto.message }, '[identidade] falha ao consultar perfil direto')
      throw new Error('falha interna ao resolver identidade')
    }
    perfil = direto as typeof perfil
  }

  // 2) Fallback: telefone armazenado em formato não-normalizado (ex. com
  //    parênteses/hífen). Varre apenas perfis com telefone preenchido.
  if (!perfil) {
    const { data: perfis, error } = await supabase
      .from('perfis')
      .select('id, nome_completo, email, telefone')
      .not('telefone', 'is', null)
      .eq('ativo', true)
      .limit(1000)

    if (error) {
      logger.error({ err: error.message }, '[identidade] falha ao consultar perfis')
      throw new Error('falha interna ao resolver identidade')
    }

    perfil =
      (perfis ?? []).find((p) => {
        if (!p.telefone) return false
        if (telefoneCorrespondeWaId(p.telefone, waId)) return true
        // Fallback: comparação por dígitos do número nacional.
        const digitos = p.telefone.replace(/\D/g, '')
        const alvos = e164 ? [e164, e164.replace(/^55/, '')] : [waId, waId.replace(/^55/, '')]
        return alvos.some((a) => a.endsWith(digitos.slice(-10)) || a.endsWith(digitos.slice(-11)))
      }) ?? null
  }

  if (!perfil) return null

  // 2) Carrega o vínculo ativo (papel + unidade) do perfil.
  const { data: vinculos, error: errVinculos } = await supabase
    .from('vinculos')
    .select('papel, ativo, unidades!vinculos_unidade_id_fkey(id, nome, organizacao_id)')
    .eq('perfil_id', perfil.id)
    .eq('ativo', true)

  if (errVinculos) {
    logger.error({ err: errVinculos.message }, '[identidade] falha ao consultar vínculos')
    throw new Error('falha interna ao resolver vínculos')
  }

  type Unidade = { id: string; nome: string; organizacao_id: string }
  const linhas = (vinculos ?? []) as unknown as {
    papel: PapelHermes
    ativo: boolean
    // O embed do PostgREST vem como objeto (relação para-um), mas os tipos
    // gerados dizem array — normalizamos para aguentar os dois.
    unidades: Unidade | Unidade[] | null
  }[]

  const listaVinculos: VinculoHermes[] = linhas.flatMap((v) => {
    const u = Array.isArray(v.unidades) ? v.unidades[0] : v.unidades
    if (!u) return []
    return [{ papel: v.papel, unidadeId: u.id, unidadeNome: u.nome, organizacaoId: u.organizacao_id }]
  })

  // Vínculo PRINCIPAL: maior precedência de papel, desempate determinístico
  // pelo unidade_id. Sem isso, um usuário com vínculos em unidades diferentes
  // receberia papel/unidade em ordem arbitrária do banco — e é esse papel que
  // as guardas de acesso usam.
  const principal = [...listaVinculos].sort(
    (a, b) =>
      PRECEDENCIA_PAPEL[b.papel] - PRECEDENCIA_PAPEL[a.papel] ||
      a.unidadeId.localeCompare(b.unidadeId)
  )[0]

  const superAdmin = await ehSuperAdmin(perfil.id)

  return {
    perfilId: perfil.id,
    nome: perfil.nome_completo,
    email: perfil.email,
    papel: principal?.papel ?? null,
    unidadeId: principal?.unidadeId ?? null,
    unidadeNome: principal?.unidadeNome ?? null,
    organizacaoId: principal?.organizacaoId ?? null,
    vinculos: listaVinculos,
    superAdmin,
  }
}

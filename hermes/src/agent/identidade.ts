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

export type IdentidadeHermes = {
  perfilId: string
  nome: string
  email: string | null
  papel: 'gestor' | 'plantonista' | 'admin' | null
  unidadeId: string | null
  unidadeNome: string | null
  /** user_id da organização (usado para conferir org de teste etc.) */
  organizacaoId: string | null
}

/**
 * Busca o perfil cujo telefone corresponde ao wa_id (E.164 normalizado).
 * Retorna null quando o número não está cadastrado.
 */
export async function resolverIdentidadePorWaId(waId: string): Promise<IdentidadeHermes | null> {
  // 1) Normaliza o wa_id e busca direta por E.164 completo (caso comum).
  const e164 = normalizarE164BR(waId)
  const alvos = e164 ? [e164, e164.replace(/^55/, '')] : [waId, waId.replace(/^55/, '')]

  const { data: perfis, error } = await supabase
    .from('perfis')
    .select('id, nome_completo, email, telefone, ativo')
    .eq('ativo', true)
    .limit(1000)

  if (error) {
    logger.error({ err: error.message }, '[identidade] falha ao consultar perfis')
    throw new Error('falha interna ao resolver identidade')
  }

  const perfil = (perfis ?? []).find((p) => {
    if (!p.telefone) return false
    // Compara com tolerância a formatos (normaliza os dois lados).
    if (telefoneCorrespondeWaId(p.telefone, waId)) return true
    // Fallback: comparação por dígitos do número nacional.
    const digitos = p.telefone.replace(/\D/g, '')
    return alvos.some((a) => a.endsWith(digitos.slice(-10)) || a.endsWith(digitos.slice(-11)))
  })

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

  const vinculo = (vinculos ?? [])[0] as
    | {
        papel: 'gestor' | 'plantonista' | 'admin'
        ativo: boolean
        unidades: { id: string; nome: string; organizacao_id: string } | null
      }
    | undefined

  return {
    perfilId: perfil.id,
    nome: perfil.nome_completo,
    email: perfil.email,
    papel: (vinculo?.papel as IdentidadeHermes['papel']) ?? null,
    unidadeId: vinculo?.unidades?.id ?? null,
    unidadeNome: vinculo?.unidades?.nome ?? null,
    organizacaoId: vinculo?.unidades?.organizacao_id ?? null,
  }
}

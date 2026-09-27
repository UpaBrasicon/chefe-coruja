// ─────────────────────────────────────────────────────────────────────────────
// HERMES — agent/identidade.ts
// Resolução de identidade: quem está falando → perfil do Chefe Coruja.
//   • WhatsApp: wa_id (telefone da Meta) comparado ao telefone do perfil;
//   • qualquer canal: vínculo em `hermes_identidades` (Telegram), criado só
//     por código de uso único gerado pela própria pessoa na plataforma.
//
// ⚠️ REGRA 3 (regras transversais): chamadas com service_role BYPASSAM o RLS.
// A camada de tools é responsável por reimplementar o filtro de papel/unidade
// no código. Aqui resolvemos APENAS o perfil + vínculos de quem fala —
// nenhum dado de outro usuário é lido.
// ─────────────────────────────────────────────────────────────────────────────
import { supabase } from '../lib/supabase.js'
import { normalizarE164BR, telefoneCorrespondeWaId } from '../lib/telefone.js'
import { logger } from '../logger.js'

/** Os 8 papéis do glossário (CONTEXT.md). */
export type PapelHermes =
  | 'admin'
  | 'gestor'
  | 'plantonista'
  | 'enfermeiro'
  | 'tecnico_enfermagem'
  | 'recepcao'
  | 'farmaceutico'
  | 'telemedicina'

/** Precedência para escolher o vínculo principal (maior = mais forte). */
const PRECEDENCIA_PAPEL: Record<PapelHermes, number> = {
  admin: 8,
  gestor: 7,
  plantonista: 6,
  enfermeiro: 5,
  telemedicina: 4,
  farmaceutico: 3,
  tecnico_enfermagem: 2,
  recepcao: 1,
}
const peso = (p: string) => PRECEDENCIA_PAPEL[p as PapelHermes] ?? 0

export type CanalHermes = 'telegram' | 'whatsapp'

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

type PerfilBase = { id: string; nome_completo: string; email: string | null }

/** Monta a identidade completa (vínculos + super_admin) de um perfil ativo. */
async function identidadeDoPerfil(perfil: PerfilBase): Promise<IdentidadeHermes> {
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
  // pelo unidade_id. Papel desconhecido pesa 0 (nunca NaN no sort).
  const principal = [...listaVinculos].sort(
    (a, b) => peso(b.papel) - peso(a.papel) || a.unidadeId.localeCompare(b.unidadeId)
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

/**
 * Busca o perfil cujo telefone corresponde ao wa_id (E.164 normalizado).
 * Retorna null quando o número não está cadastrado.
 *
 * Só casa telefone BRASILEIRO COMPLETO dos dois lados (ver
 * telefoneCorrespondeWaId): telefone vazio, "-", "n/a" ou curto não casa com
 * nada — antes, um "termina com" vazio transformava qualquer número
 * desconhecido nesse perfil (auditoria 27/09).
 */
export async function resolverIdentidadePorWaId(waId: string): Promise<IdentidadeHermes | null> {
  const e164 = normalizarE164BR(waId)
  if (!e164) return null

  // 1) Busca direta por E.164 completo (caso comum e barato).
  const { data: direto, error: errDireto } = await supabase
    .from('perfis')
    .select('id, nome_completo, email, telefone')
    .eq('telefone', e164)
    .eq('ativo', true)
    .limit(2)
  if (errDireto) {
    logger.error({ err: errDireto.message }, '[identidade] falha ao consultar perfil direto')
    throw new Error('falha interna ao resolver identidade')
  }
  const candidatos = (direto ?? []) as (PerfilBase & { telefone: string | null })[]

  // 2) Telefone guardado em outro formato ("(62) 9…"): varre, em páginas,
  //    só perfis com telefone preenchido, com a comparação estrita.
  if (candidatos.length === 0) {
    for (let de = 0; ; de += 1000) {
      const { data: pagina, error } = await supabase
        .from('perfis')
        .select('id, nome_completo, email, telefone')
        .not('telefone', 'is', null)
        .eq('ativo', true)
        .order('id')
        .range(de, de + 999)
      if (error) {
        logger.error({ err: error.message }, '[identidade] falha ao consultar perfis')
        throw new Error('falha interna ao resolver identidade')
      }
      candidatos.push(...((pagina ?? []) as typeof candidatos).filter((p) => p.telefone && telefoneCorrespondeWaId(p.telefone, waId)))
      if (!pagina || pagina.length < 1000) break
    }
  }

  // Dois perfis com o mesmo telefone: ambíguo — melhor não responder do que
  // responder como a pessoa errada.
  if (candidatos.length !== 1) {
    if (candidatos.length > 1) logger.warn({ quantidade: candidatos.length }, '[identidade] telefone ambíguo — recusado')
    return null
  }
  return identidadeDoPerfil(candidatos[0]!)
}

/**
 * Identidade por vínculo de canal (Telegram…). O identificador vem da SESSÃO
 * do canal (preenchido pelo gateway do Nous a partir da mensagem recebida),
 * nunca de argumento que o modelo escolha.
 */
export async function resolverIdentidadePorCanal(canal: CanalHermes, identificador: string): Promise<IdentidadeHermes | null> {
  if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(identificador)) return null
  const { data, error } = await supabase
    .from('hermes_identidades')
    .select('perfis!hermes_identidades_perfil_id_fkey(id, nome_completo, email, ativo)')
    .eq('canal', canal)
    .eq('identificador', identificador)
    .maybeSingle()
  if (error) {
    logger.error({ err: error.message }, '[identidade] falha ao consultar vínculo de canal')
    throw new Error('falha interna ao resolver identidade')
  }
  const p = (data as { perfis: (PerfilBase & { ativo: boolean }) | (PerfilBase & { ativo: boolean })[] | null } | null)?.perfis
  const perfil = Array.isArray(p) ? p[0] : p
  if (!perfil || !perfil.ativo) return null
  return identidadeDoPerfil(perfil)
}

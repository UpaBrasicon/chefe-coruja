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
import { supabaseUser } from '../lib/supabase.js'
import { normalizarE164BR } from '../lib/telefone.js'
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
 * Linha das RPCs de identidade (hermes_identidade_por_telefone / _por_canal).
 * O escopo (super_admin, vínculos) é resolvido DENTRO do SQL — o Hermes não lê
 * mais `super_admins`/`vinculos` direto (hermes_user não tem grant de tabela).
 */
type VinculoRpc = {
  unidade_id: string
  papel: PapelHermes
  unidade_nome: string
  organizacao_id: string
}
type IdentidadeRpc = {
  perfil_id: string
  nome_completo: string
  email: string | null
  is_super_admin: boolean
  vinculos: VinculoRpc[] | null
}

/** Monta a IdentidadeHermes a partir da linha da RPC (vínculos + super já vêm). */
function montarIdentidade(row: IdentidadeRpc): IdentidadeHermes {
  const listaVinculos: VinculoHermes[] = (row.vinculos ?? []).map((v) => ({
    papel: v.papel,
    unidadeId: v.unidade_id,
    unidadeNome: v.unidade_nome,
    organizacaoId: v.organizacao_id,
  }))

  // Vínculo PRINCIPAL: maior precedência de papel, desempate determinístico
  // pelo unidade_id. Papel desconhecido pesa 0 (nunca NaN no sort).
  const principal = [...listaVinculos].sort(
    (a, b) => peso(b.papel) - peso(a.papel) || a.unidadeId.localeCompare(b.unidadeId)
  )[0]

  return {
    perfilId: row.perfil_id,
    nome: row.nome_completo,
    email: row.email,
    papel: principal?.papel ?? null,
    unidadeId: principal?.unidadeId ?? null,
    unidadeNome: principal?.unidadeNome ?? null,
    organizacaoId: principal?.organizacaoId ?? null,
    vinculos: listaVinculos,
    // `=== true` proposital: ausência/undefined falha FECHADA (nunca concede).
    superAdmin: row.is_super_admin === true,
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

  // A RPC compara por dígitos (ignora formatação), já traz vínculos+super e
  // devolve VAZIO quando o telefone é ambíguo (dois perfis) — o antigo scan
  // cross-tenant da tabela `perfis` some.
  const { data, error } = await supabaseUser.rpc('hermes_identidade_por_telefone', { p_e164: e164 })
  if (error) {
    logger.error({ err: error.message }, '[identidade] falha ao resolver identidade')
    throw new Error('falha interna ao resolver identidade')
  }
  // RETURNS TABLE → array de linhas. Ambíguo/não achado → 0 linhas.
  const linhas = (data ?? []) as IdentidadeRpc[]
  if (linhas.length !== 1) {
    if (linhas.length > 1) logger.warn({ quantidade: linhas.length }, '[identidade] telefone ambíguo — recusado')
    return null
  }
  return montarIdentidade(linhas[0]!)
}

/**
 * Identidade por vínculo de canal (Telegram…). O identificador vem da SESSÃO
 * do canal (preenchido pelo gateway do Nous a partir da mensagem recebida),
 * nunca de argumento que o modelo escolha.
 */
export async function resolverIdentidadePorCanal(canal: CanalHermes, identificador: string): Promise<IdentidadeHermes | null> {
  if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(identificador)) return null
  const { data, error } = await supabaseUser.rpc('hermes_identidade_por_canal', {
    p_canal: canal,
    p_identificador: identificador,
  })
  if (error) {
    logger.error({ err: error.message }, '[identidade] falha ao consultar vínculo de canal')
    throw new Error('falha interna ao resolver identidade')
  }
  // RETURNS TABLE → array; a RPC só casa perfil ATIVO. Nada casado → 0 linhas.
  const linhas = (data ?? []) as IdentidadeRpc[]
  if (linhas.length === 0) return null
  return montarIdentidade(linhas[0]!)
}

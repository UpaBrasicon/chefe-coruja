import { supabase } from '@/lib/supabase'
import type { Json, Papel, TipoLeito, TipoSetor } from '@/types/database'

// ── Auditoria ────────────────────────────────────────────────────────────────
export async function registrarAuditoria(input: {
  acao: string
  entidade: string
  entidade_id?: string | null
  unidade_id?: string | null
  payload?: Json | null
}) {
  const { error } = await supabase.rpc('registrar_auditoria', {
    p_acao: input.acao,
    p_entidade: input.entidade,
    p_entidade_id: input.entidade_id ?? undefined,
    p_unidade_id: input.unidade_id ?? undefined,
    p_payload: input.payload ?? undefined,
  })
  if (error) console.error('Falha ao registrar auditoria:', error)
}

// ── Vínculos (admin) ─────────────────────────────────────────────────────────
export async function criarOuReativarVinculo(input: {
  perfil_id: string
  unidade_id: string
  papel: Papel
  criado_por: string
}) {
  const { data, error } = await supabase
    .from('vinculos')
    .upsert(
      {
        perfil_id: input.perfil_id,
        unidade_id: input.unidade_id,
        papel: input.papel,
        ativo: true,
        criado_por: input.criado_por,
      },
      { onConflict: 'perfil_id,unidade_id,papel' }
    )
    .select('id, papel')
    .single()

  if (error) throw error

  await registrarAuditoria({
    acao: 'vinculo_criado',
    entidade: 'vinculos',
    entidade_id: data.id,
    unidade_id: input.unidade_id,
    payload: { perfil_id: input.perfil_id, papel: input.papel },
  })
}

export async function revogarVinculo(vinculoId: string, unidadeId: string) {
  const { data, error } = await supabase
    .from('vinculos')
    .update({ ativo: false })
    .eq('id', vinculoId)
    .select('id, perfil_id, papel')
    .single()

  if (error) throw error

  await registrarAuditoria({
    acao: 'vinculo_revogado',
    entidade: 'vinculos',
    entidade_id: vinculoId,
    unidade_id: unidadeId,
    payload: { perfil_id: data.perfil_id, papel: data.papel },
  })
}

// ── Setores (gestor) ─────────────────────────────────────────────────────────
export async function criarSetor(input: {
  unidade_id: string
  nome: string
  tipo: TipoSetor
  ordem: number
}) {
  const { data, error } = await supabase
    .from('setores')
    .insert({ unidade_id: input.unidade_id, nome: input.nome, tipo: input.tipo, ordem: input.ordem })
    .select('id')
    .single()

  if (error) throw error

  await registrarAuditoria({
    acao: 'setor_criado',
    entidade: 'setores',
    entidade_id: data.id,
    unidade_id: input.unidade_id,
    payload: { nome: input.nome, tipo: input.tipo },
  })

  return data
}

export async function atualizarSetor(
  id: string,
  unidadeId: string,
  campos: { nome?: string; tipo?: TipoSetor; ordem?: number; ativo?: boolean }
) {
  const { data, error } = await supabase
    .from('setores')
    .update(campos)
    .eq('id', id)
    .select('id')
    .single()

  if (error) throw error

  await registrarAuditoria({
    acao: 'setor_atualizado',
    entidade: 'setores',
    entidade_id: id,
    unidade_id: unidadeId,
    payload: campos,
  })

  return data
}

export async function excluirSetor(id: string, unidadeId: string, nome: string) {
  const { error } = await supabase.from('setores').delete().eq('id', id)
  if (error) throw error

  await registrarAuditoria({
    acao: 'setor_excluido',
    entidade: 'setores',
    entidade_id: id,
    unidade_id: unidadeId,
    payload: { nome },
  })
}

export async function salvarOrdemSetores(unidadeId: string, idsEmOrdem: string[]) {
  for (const [ordem, id] of idsEmOrdem.entries()) {
    await supabase.from('setores').update({ ordem }).eq('id', id)
  }
  await registrarAuditoria({
    acao: 'setores_reordenados',
    entidade: 'setores',
    unidade_id: unidadeId,
  })
}

// ── Leitos (gestor) ──────────────────────────────────────────────────────────
export async function criarLeitos(input: {
  setor_id: string
  unidade_id: string
  prefixo: string
  quantidade: number
  tipo: TipoLeito
}) {
  const linhas = Array.from({ length: input.quantidade }, (_, i) => ({
    setor_id: input.setor_id,
    identificador: `${input.prefixo}${String(i + 1).padStart(2, '0')}`,
    tipo: input.tipo,
  }))

  const { data, error } = await supabase.from('leitos').insert(linhas).select('id, identificador')

  if (error) throw error

  await registrarAuditoria({
    acao: 'leitos_criados',
    entidade: 'leitos',
    unidade_id: input.unidade_id,
    payload: { setor_id: input.setor_id, quantidade: data.length, prefixo: input.prefixo },
  })
}

export async function atualizarStatusLeito(
  id: string,
  unidadeId: string,
  status: 'livre' | 'ocupado' | 'bloqueado' | 'higienizacao'
) {
  const { error } = await supabase.from('leitos').update({ status }).eq('id', id)
  if (error) throw error

  await registrarAuditoria({
    acao: `leito_${status}`,
    entidade: 'leitos',
    entidade_id: id,
    unidade_id: unidadeId,
  })
}

export async function excluirLeito(id: string, unidadeId: string) {
  const { error } = await supabase.from('leitos').delete().eq('id', id)
  if (error) throw error

  await registrarAuditoria({
    acao: 'leito_excluido',
    entidade: 'leitos',
    entidade_id: id,
    unidade_id: unidadeId,
  })
}

// ── Banners (gestor da unidade) ──────────────────────────────────────────────
export type BannerInput = {
  unidade_id: string
  titulo?: string | null
  descricao?: string | null
  imagem_url: string
  link_url?: string | null
  ordem?: number
}

export async function criarBanner(input: BannerInput) {
  const { data, error } = await supabase
    .from('banners')
    .insert(input)
    .select('id')
    .single()
  if (error) throw error

  await registrarAuditoria({
    acao: 'banner_criado',
    entidade: 'banners',
    entidade_id: data.id,
    unidade_id: input.unidade_id,
  })
  return data
}

export async function atualizarBanner(
  id: string,
  unidadeId: string,
  campos: { titulo?: string | null; descricao?: string | null; link_url?: string | null; ativo?: boolean }
) {
  const { error } = await supabase.from('banners').update(campos).eq('id', id)
  if (error) throw error

  await registrarAuditoria({
    acao: 'banner_atualizado',
    entidade: 'banners',
    entidade_id: id,
    unidade_id: unidadeId,
    payload: campos,
  })
}

export async function excluirBanner(id: string, unidadeId: string, imagemUrl: string) {
  await excluirBannerImagem(imagemUrl)
  const { error } = await supabase.from('banners').delete().eq('id', id)
  if (error) throw error

  await registrarAuditoria({
    acao: 'banner_excluido',
    entidade: 'banners',
    entidade_id: id,
    unidade_id: unidadeId,
  })
}

export async function reordenarBanners(unidadeId: string, idsEmOrdem: string[]) {
  for (const [ordem, id] of idsEmOrdem.entries()) {
    await supabase.from('banners').update({ ordem }).eq('id', id)
  }
  await registrarAuditoria({
    acao: 'banners_reordenados',
    entidade: 'banners',
    unidade_id: unidadeId,
  })
}

export async function uploadBannerImagem(unidadeId: string, file: File) {
  const nomeSeguro = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const caminho = `${unidadeId}/${crypto.randomUUID()}-${nomeSeguro}`
  const { error } = await supabase.storage.from('banners').upload(caminho, file, {
    cacheControl: '3600',
    upsert: false,
  })
  if (error) throw error

  const { data } = supabase.storage.from('banners').getPublicUrl(caminho)
  return data.publicUrl
}

export async function excluirBannerImagem(imagemUrl: string) {
  const prefixo = '/storage/v1/object/public/banners/'
  const idx = imagemUrl.indexOf(prefixo)
  if (idx === -1) return
  const caminho = imagemUrl.slice(idx + prefixo.length)
  await supabase.storage.from('banners').remove([caminho])
}

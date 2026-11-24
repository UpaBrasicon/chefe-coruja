// LG7: assinatura ICP-Brasil pelo assinador (services/assinador, no VPS).
// Desligada até a homologação com um provedor real: sem VITE_ASSINADOR_URL,
// nada aparece e nada é chamado. O médico abre a sessão uma vez por plantão;
// cada documento emitido dos tipos abaixo é assinado em seguida.
import { supabase } from '@/lib/supabase'
import { bytesDoBytea, pedirAoAssinador, PRAZO_ASSINADOR_MS, PRAZO_ASSINAR_MS, TIPOS_ASSINAVEIS, type SessaoAssinatura } from '@/lib/assinadorPuro'

export { TIPOS_ASSINAVEIS, textoDaSessao, type SessaoAssinatura } from '@/lib/assinadorPuro'

export const URL_ASSINADOR = String(import.meta.env.VITE_ASSINADOR_URL ?? '').replace(/\/$/, '')
export const assinaturaLigada = () => URL_ASSINADOR.length > 0

async function chamar<T>(caminho: string, init: RequestInit = {}, prazoMs = PRAZO_ASSINADOR_MS): Promise<T> {
  const { data } = await supabase.auth.getSession()
  const jwt = data.session?.access_token
  if (!jwt) throw new Error('Sessão do sistema expirada. Entre de novo.')
  return pedirAoAssinador<T>(fetch, `${URL_ASSINADOR}${caminho}`, {
    ...init,
    headers: { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', ...(init.headers as Record<string, string> | undefined) },
  }, prazoMs)
}

export const minhaSessaoAssinatura = () => chamar<SessaoAssinatura>('/sessao')
export const encerrarSessaoAssinatura = () => chamar<void>('/sessao/encerrar', { method: 'POST' })

/** Abre a autorização do provedor numa janela nova (o médico autoriza no celular). */
export async function iniciarSessaoAssinatura(provedor: string): Promise<void> {
  const { url } = await chamar<{ url: string }>('/sessao/iniciar', { method: 'POST', body: JSON.stringify({ provedor }) })
  window.open(url, '_blank', 'noopener,noreferrer')
}

export type ResultadoAssinatura = 'assinado' | 'sem-sessao' | 'nao-se-aplica' | 'erro'

/**
 * Depois de emitir: assina se a assinatura estiver ligada, o tipo for
 * assinável e houver sessão. Nunca bloqueia a emissão: o documento emitido
 * vale como hoje, e a falha só é contada.
 */
export async function assinarSeDer(doc: { id: string; tipo: string }): Promise<ResultadoAssinatura> {
  if (!assinaturaLigada() || !TIPOS_ASSINAVEIS.has(doc.tipo)) return 'nao-se-aplica'
  try {
    await chamar('/assinar', { method: 'POST', body: JSON.stringify({ documento_id: doc.id }) }, PRAZO_ASSINAR_MS)
    window.dispatchEvent(new CustomEvent('cc-documento-assinado', { detail: doc.id }))
    return 'assinado'
  } catch (e) {
    return (e as { status?: number }).status === 409 ? 'sem-sessao' : 'erro'
  }
}

/** Abre o PDF assinado do documento (a RLS decide se quem pede pode ver). */
export async function abrirPdfAssinado(documentoId: string): Promise<void> {
  const janela = window.open('', '_blank')
  const a = await supabase.from('assinaturas_documento').select('id').eq('documento_id', documentoId).maybeSingle()
  if (a.error || !a.data) { janela?.close(); throw new Error('Assinatura não encontrada') }
  const p = await supabase.from('pdfs_assinados').select('pdf').eq('assinatura_id', a.data.id).maybeSingle()
  if (p.error || !p.data) { janela?.close(); throw new Error('PDF assinado não encontrado') }
  const blob = new Blob([bytesDoBytea(String(p.data.pdf)).buffer as ArrayBuffer], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  if (janela) janela.location.href = url
  else window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

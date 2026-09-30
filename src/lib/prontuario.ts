import { supabase } from '@/lib/supabase'
import { folhaDoRegistro, lerConteudo, montarFolha, type TipoFolha } from '@/lib/folhas'

// Consulta e impressão são registradas pelo SERVIDOR (migration 0012). O banco
// só devolve conteúdo clínico de prontuário aberto; abrir é a RPC que grava o
// acesso. Aqui ficam as duas portas que o app usa.

const aberturas = new Map<string, number>()
const VALIDADE_LOCAL_MS = 60_000 // o servidor já agrupa aberturas em 5 min

/**
 * Abre o prontuário do paciente (grava a consulta no servidor). Chamar antes
 * de ler documentos, observações, prescrições, checklist ou alta — sem isso,
 * essas tabelas voltam vazias.
 */
export async function abrirProntuario(pacienteId: string, internacaoId?: string | null): Promise<void> {
  const chave = `${pacienteId}:${internacaoId ?? ''}`
  const ultima = aberturas.get(chave)
  if (ultima && Date.now() - ultima < VALIDADE_LOCAL_MS) return
  const { error } = await supabase.rpc('abrir_prontuario', {
    p_paciente: pacienteId,
    p_internacao: internacaoId ?? undefined,
  })
  if (error) throw error
  aberturas.set(chave, Date.now())
}

/** Igual a abrirProntuario, partindo da internação. */
export async function abrirProntuarioDaInternacao(internacaoId: string): Promise<void> {
  const { data, error } = await supabase
    .from('internacoes')
    .select('paciente_id')
    .eq('id', internacaoId)
    .maybeSingle()
  if (error) throw error
  if (!data) throw new Error('Internação não encontrada.')
  await abrirProntuario(data.paciente_id, internacaoId)
}

export function esquecerAberturas() {
  aberturas.clear()
}

/**
 * `pronta`: a folha já está escrita na janela (documento emitido, montado no
 * servidor, ou folha provisória) — quem chamou só imprime. Sem `pronta`, quem
 * chamou escreve a folha e põe o `rodape` (impressões que não são documento,
 * como a evolução).
 */
type Impressao = { janela: Window; rodape: string; provisoria: boolean; pronta: boolean }

export type TipoDocumentoPorta = TipoFolha

const falhaDeRede = (e: { message?: string } | null) =>
  !navigator.onLine || (!!e && /fetch|network|timeout|Failed to send/i.test(e.message ?? ''))

function escrever(janela: Window, html: string) {
  janela.document.open()
  janela.document.write(html)
  janela.document.close()
}

/**
 * Sem conexão: a folha sai PROVISÓRIA (sem número, assinar à mão) e o
 * documento vai para a fila; ao voltar a conexão recebe número e a impressão
 * provisória é registrada (ADR 0009, fase 2.5). É a única folha montada no
 * aparelho — com o mesmo modelo do servidor (`lib/folhas`).
 */
async function folhaProvisoria(
  janela: Window,
  recusar: (m: string) => null,
  opcoes: { pacienteId: string; documento: { tipo: TipoDocumentoPorta; conteudo: string } }
): Promise<Impressao | null> {
  const { situacaoSemConexao, agoraServidor } = await import('@/lib/offline/relogio')
  const { gravarRegistros, novoItem } = await import('@/lib/offline/sincronizar')
  const situacao = situacaoSemConexao()
  if (!situacao.pode) return recusar(`Sem conexão: ${situacao.motivo}`)
  const { data } = await supabase.auth.getSession()
  const perfil = data.session?.user.id
  if (!perfil) return recusar('Sem conexão e sem sessão ativa neste aparelho.')
  await gravarRegistros(perfil, [
    novoItem('documento', { paciente_id: opcoes.pacienteId, tipo: opcoes.documento.tipo, conteudo: opcoes.documento.conteudo }),
  ])
  // o aviso de folha provisória e o rodapé sem número vêm do modelo (emissão 'provisoria')
  const em = new Date(agoraServidor() ?? Date.now()).toISOString()
  escrever(janela, montarFolha(opcoes.documento.tipo, lerConteudo(opcoes.documento.conteudo), { emissao: { modo: 'provisoria', em } }))
  return { janela, rodape: '', provisoria: true, pronta: true }
}

/**
 * Folha do documento EMITIDO, montada no servidor (edge function `folha`,
 * Fase 4.2): ela registra a impressão e usa o conteúdo gravado no banco. Se a
 * função não responder, a mesma folha é montada aqui a partir do mesmo
 * registro do banco (RPC folha_documento), com o mesmo rodapé.
 */
async function folhaEmitida(janela: Window, recusar: (m: string) => null, documentoId: string, tipoImpressao: string) {
  const r = await folhaDoDocumentoEmitido(documentoId, tipoImpressao)
  if ('erro' in r) {
    recusar(`O documento foi emitido, mas a folha não pôde ser montada${r.erro ? `: ${r.erro}` : ''}. Reimprima pelo documento.`)
    return false
  }
  escrever(janela, r.html)
  return true
}

/**
 * HTML da folha A4 de um documento JÁ EMITIDO (edge function `folha`; se ela
 * não responder, o mesmo registro do banco via RPC folha_documento). Cada
 * chamada registra uma impressão do documento. Usada pela folha do documento
 * e pela impressão de prontuário, que junta várias folhas numa janela só.
 */
export async function folhaDoDocumentoEmitido(documentoId: string, tipoImpressao: string): Promise<{ html: string } | { erro: string }> {
  const r = await supabase.functions.invoke('folha', {
    body: { documento_id: documentoId, tipo_impressao: tipoImpressao, origem: window.location.origin },
  })
  if (!r.error && typeof r.data === 'string' && r.data.startsWith('<!doctype html>')) return { html: r.data }
  const { data, error } = await supabase.rpc('folha_documento', { p_documento: documentoId, p_tipo_impressao: tipoImpressao })
  if (error || !data) return { erro: error?.message ?? '' }
  try {
    return { html: folhaDoRegistro(data as unknown as Parameters<typeof folhaDoRegistro>[0]) }
  } catch {
    return { erro: 'conteúdo do documento ilegível' }
  }
}

/**
 * Prepara uma impressão registrada. A janela abre JÁ (ainda dentro do clique,
 * senão o navegador bloqueia o pop-up); depois o servidor registra e devolve o
 * protocolo. Sem paciente identificado ou sem registro, não imprime — a
 * janela mostra o motivo.
 *
 * Com `documento`, o documento é EMITIDO no episódio antes (número da unidade)
 * e a folha vem pronta do servidor. Sem conexão, sai a folha provisória.
 */
export async function abrirImpressao(opcoes: {
  pacienteId?: string | null
  internacaoId?: string | null
  tipo: string
  documento?: { tipo: TipoDocumentoPorta; conteudo: string }
  /** rascunho do banco (Fase 4.1): se houver, é ele que vira o documento emitido */
  rascunhoId?: string | null
}): Promise<Impressao | null> {
  const janela = window.open('', '_blank')
  if (!janela) return null
  janela.document.write(
    '<p style="font:15px system-ui,sans-serif;padding:24px;color:#475569">Registrando impressão…</p>'
  )

  const recusar = (motivo: string) => {
    escrever(janela, `<p style="font:15px system-ui,sans-serif;padding:24px;color:#B91C1C">${motivo}</p>`)
    return null
  }

  if (!opcoes.pacienteId) {
    return recusar('Selecione ou cadastre o paciente antes de imprimir: toda impressão fica registrada no prontuário dele.')
  }
  if (opcoes.documento) {
    const doc = opcoes.documento
    const pacienteId = opcoes.pacienteId
    // com rascunho no banco: grava o texto final nele e emite o próprio rascunho
    const viaRascunho = async () => {
      if (!opcoes.rascunhoId) return null
      const s = await supabase.rpc('salvar_rascunho', {
        p_paciente: pacienteId, p_tipo: doc.tipo, p_conteudo: doc.conteudo, p_rascunho: opcoes.rascunhoId,
      })
      if (s.error) return /Rascunho não encontrado/.test(s.error.message) ? null : s
      return supabase.rpc('emitir_rascunho', { p_rascunho: opcoes.rascunhoId })
    }
    const { data, error } = (await viaRascunho()) ?? (await supabase.rpc('emitir_documento', {
      p_paciente: pacienteId,
      p_tipo: doc.tipo,
      p_conteudo: doc.conteudo,
    }))
    if (error) {
      if (falhaDeRede(error)) return folhaProvisoria(janela, recusar, { pacienteId, documento: doc })
      return recusar(`Não foi possível emitir o documento: ${error.message}. Nada foi impresso.`)
    }
    const documento = data as { id: string; numero: string }
    if (!(await folhaEmitida(janela, recusar, documento.id, opcoes.tipo))) return null
    return { janela, rodape: '', provisoria: false, pronta: true }
  }

  // impressão que não é documento assistencial (ex.: evolução): só o registro
  const { data, error } = await supabase.rpc('registrar_impressao', {
    p_paciente: opcoes.pacienteId,
    p_documento_tipo: opcoes.tipo,
    p_internacao: opcoes.internacaoId ?? undefined,
  })
  const registro = Array.isArray(data) ? data[0] : null
  if (error || !registro) {
    return recusar(`Não foi possível registrar a impressão${error ? `: ${error.message}` : ''}. Nada foi impresso.`)
  }
  const emitido = new Date(registro.emitido_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const rodape =
    `<div style="position:fixed;left:0;right:0;bottom:6mm;text-align:center;font:9px system-ui,sans-serif;color:#64748B">` +
    `Impressão ${registro.protocolo} registrada no Chefe Coruja em ${emitido}</div>`
  janela.document.open()
  return { janela, rodape, provisoria: false, pronta: false }
}

import { supabase } from '@/lib/supabase'

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

type Impressao = { janela: Window; rodape: string; provisoria: boolean }

export type TipoDocumentoPorta = 'atestado' | 'receita' | 'encaminhamento' | 'pedido_exames' | 'prescricao' | 'laudo_aih'

const falhaDeRede = (e: { message?: string } | null) =>
  !navigator.onLine || (!!e && /fetch|network|timeout/i.test(e.message ?? ''))

/**
 * Sem conexão: a folha sai PROVISÓRIA (sem número, assinar à mão) e o
 * documento vai para a fila; ao voltar a conexão recebe número e a impressão
 * provisória é registrada (ADR 0009, fase 2.5).
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
  const quando = new Date(agoraServidor() ?? Date.now()).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const rodape =
    `<div style="position:fixed;left:0;right:0;top:4mm;text-align:center;font:600 12px system-ui,sans-serif;color:#B91C1C;border:1.5px solid #B91C1C;margin:0 12mm;padding:4px">` +
    `FOLHA PROVISÓRIA — emitida sem conexão em ${quando}. Sem número definitivo: assinar à mão. O número sai quando a conexão voltar.</div>` +
    `<div style="position:fixed;left:0;right:0;bottom:6mm;text-align:center;font:9px system-ui,sans-serif;color:#64748B">` +
    `Chefe Coruja · folha provisória · registro guardado no aparelho para envio</div>`
  janela.document.open()
  return { janela, rodape, provisoria: true }
}

/**
 * Prepara uma impressão registrada. A janela abre JÁ (ainda dentro do clique,
 * senão o navegador bloqueia o pop-up); depois o servidor registra e devolve o
 * protocolo, que vai no rodapé do papel. Sem paciente identificado ou sem
 * registro, não imprime — a janela mostra o motivo.
 *
 * Com `documento`, o documento é EMITIDO no episódio antes (número da unidade)
 * e a impressão fica ligada a ele. Sem conexão, sai a folha provisória.
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
    janela.document.open()
    janela.document.write(
      `<p style="font:15px system-ui,sans-serif;padding:24px;color:#B91C1C">${motivo}</p>`
    )
    janela.document.close()
    return null
  }

  if (!opcoes.pacienteId) {
    return recusar('Selecione ou cadastre o paciente antes de imprimir: toda impressão fica registrada no prontuário dele.')
  }
  // 1) o documento nasce no episódio (com número), antes do papel
  let documento: { id: string; numero: string } | null = null
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
      if (falhaDeRede(error)) {
        return folhaProvisoria(janela, recusar, { pacienteId: opcoes.pacienteId, documento: opcoes.documento })
      }
      return recusar(`Não foi possível emitir o documento: ${error.message}. Nada foi impresso.`)
    }
    documento = data as { id: string; numero: string }
  }

  // 2) a impressão é registrada (ligada ao documento, quando houver)
  const { data, error } = await supabase.rpc('registrar_impressao', {
    p_paciente: opcoes.pacienteId,
    p_documento_tipo: opcoes.tipo,
    p_internacao: opcoes.internacaoId ?? undefined,
    p_documento: documento?.id,
  })
  const registro = Array.isArray(data) ? data[0] : null
  if (error || !registro) {
    return recusar(`Não foi possível registrar a impressão${error ? `: ${error.message}` : ''}. Nada foi impresso.`)
  }

  const emitido = new Date(registro.emitido_em).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  const rodape =
    `<div style="position:fixed;left:0;right:0;bottom:6mm;text-align:center;font:9px system-ui,sans-serif;color:#64748B">` +
    `${documento ? `Documento nº ${documento.numero} · ` : ''}Impressão ${registro.protocolo} registrada no Chefe Coruja em ${emitido}</div>`
  janela.document.open()
  return { janela, rodape, provisoria: false }
}

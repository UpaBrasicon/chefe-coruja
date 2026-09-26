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

type Impressao = { janela: Window; rodape: string }

/**
 * Prepara uma impressão registrada. A janela abre JÁ (ainda dentro do clique,
 * senão o navegador bloqueia o pop-up); depois o servidor registra e devolve o
 * protocolo, que vai no rodapé do papel. Sem paciente identificado ou sem
 * registro, não imprime — a janela mostra o motivo.
 */
export async function abrirImpressao(opcoes: {
  pacienteId?: string | null
  internacaoId?: string | null
  tipo: string
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
  return { janela, rodape }
}

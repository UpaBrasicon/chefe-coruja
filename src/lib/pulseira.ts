// Impressão da pulseira de identificação (lacuna 2; RT 10/11/2026, A em
// P1–P8). Uma chamada só ao servidor (registrar_impressao_pulseira) registra
// a impressão e devolve o protocolo IMP- e os dados da pulseira: o papel só
// sai com o protocolo, e toda tela imprime a mesma etiqueta.
//
// P6: etiqueta do tamanho da pulseira (cerca de 2,5 × 10 cm; RN 2 × 8 cm),
// letra de 12 pt ou mais, sem itálico, numa folha A4 comum para recortar e
// prender na pulseira branca. Não usa o cabeçalho das folhas, que traz o
// leito (o protocolo proíbe o leito como identificador).
import { supabase } from '@/lib/supabase'
import { dataHoraCarimbo } from './formato.ts'
import { montarPulseira, type DadosPulseira, type MotivoReimpressao } from '@/domain/pulseira'
import { esc, folhaPulseira } from './folhaPulseira.ts'

const mensagem = (texto: string, erro = false) =>
  `<p style="font:15px system-ui,sans-serif;padding:24px;color:${erro ? 'firebrick' : 'dimgray'}">${esc(texto)}</p>`

function escrever(janela: Window, html: string) {
  janela.document.open()
  janela.document.write(html)
  janela.document.close()
}

export type PedidoPulseira = {
  pacienteId: string
  reimpressao?: boolean
  motivo?: MotivoReimpressao
  detalhe?: string
}

/**
 * Registra e imprime a pulseira. Chamar dentro do clique (a janela abre na
 * hora, senão o navegador bloqueia). Devolve a mensagem de erro, ou null.
 */
export async function imprimirPulseira(o: PedidoPulseira): Promise<string | null> {
  const janela = window.open('', '_blank')
  if (!janela) return 'O navegador bloqueou a janela de impressão. Libere as janelas deste site e tente de novo.'
  escrever(janela, mensagem('Registrando impressão…'))
  const { data, error } = await supabase.rpc('registrar_impressao_pulseira', {
    p_paciente: o.pacienteId,
    p_reimpressao: o.reimpressao ?? false,
    p_motivo: o.reimpressao ? o.motivo : undefined,
    p_detalhe: o.reimpressao && o.motivo === 'outro' ? o.detalhe?.trim() : undefined,
  })
  const r = data as { protocolo?: string; emitido_em?: string; pulseira?: DadosPulseira } | null
  if (error || !r?.protocolo || !r.pulseira) {
    const motivo = `Não foi possível registrar a impressão${error ? `: ${error.message}` : ''}. Nada foi impresso.`
    escrever(janela, mensagem(motivo, true))
    return motivo
  }
  escrever(janela, folhaPulseira(montarPulseira(r.pulseira), {
    protocolo: r.protocolo,
    emitido: r.emitido_em ? dataHoraCarimbo(r.emitido_em) : '',
  }))
  janela.focus()
  setTimeout(() => janela.print(), 300)
  return null
}

// A última classificação de risco do paciente (RPC triagem_recente_do_paciente):
// vitais crus, O₂, Glasgow, comorbidades e medicações. O encaminhamento imprime
// os vitais "da classificação, como registrados" e a ficha de admissão parte
// deles. Sem marca de alterado: a análise é de quem atende.
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'

export type TriagemRecente = {
  id: string
  criado_em: string
  cor: string
  publico: string
  queixa: string | null
  avaliacao: { avdi?: string; glasgow?: number; tempo_sintomas?: string; comorbidades?: string; medicacoes?: string }
  oxigenio: { modo?: string; litros_min?: number } | null
  sinais: Record<string, number>
}

export function useTriagemRecente(pacienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['triagem-recente', pacienteId],
    enabled: !!pacienteId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('triagem_recente_do_paciente', { p_paciente: pacienteId! })
      if (error) throw error
      return (data ?? null) as unknown as TriagemRecente | null
    },
  })
}

const br = (n: number | undefined) => (n === undefined || n === null ? '' : String(n).replace('.', ','))

export type VitaisAdm = { pa: string; fc: string; fr: string; tax: string; spo2: string; spo2Cond: string; o2L: string; hgt: string; peso: string; glasgow: string; comorb: string; meds: string }

/** Vitais da triagem no formato da ficha de admissão do protótipo (admComTriagem). */
export function vitaisDaTriagem(t: TriagemRecente | null | undefined): Partial<VitaisAdm> {
  if (!t) return {}
  const s = t.sinais ?? {}
  const pas = s['pressao-arterial-sistolica']
  const pad = s['pressao-arterial-diastolica']
  const modo = t.oxigenio?.modo
  return {
    pa: pas !== undefined || pad !== undefined ? `${pas ?? ''}/${pad ?? ''}` : '',
    fc: br(s['frequencia-cardiaca']),
    fr: br(s['frequencia-respiratoria']),
    tax: br(s['temperatura']),
    spo2: br(s['saturacao-o2']),
    spo2Cond: modo === 'ar_ambiente' ? 'ar' : modo === 'o2_suplementar' ? 'o2' : '',
    o2L: br(t.oxigenio?.litros_min),
    hgt: br(s['glicemia-capilar']),
    peso: br(s['peso']),
    glasgow: t.avaliacao?.glasgow !== undefined ? String(t.avaliacao.glasgow) : '',
    comorb: t.avaliacao?.comorbidades ?? '',
    meds: t.avaliacao?.medicacoes ?? '',
  }
}

/** "PA 120/80 · FC 88 · …" como o encaminhamento imprime (encVitais do protótipo). */
export function textoVitaisTriagem(t: TriagemRecente | null | undefined) {
  if (!t) return ''
  const a = vitaisDaTriagem(t)
  const cond = a.spo2Cond === 'ar' ? ' em ar ambiente' : a.spo2Cond === 'o2' ? ` em O₂${a.o2L ? ` ${a.o2L} L/min` : ''}` : ''
  return [
    a.pa ? `PA ${a.pa}` : '', a.fc ? `FC ${a.fc}` : '', a.fr ? `FR ${a.fr}` : '', a.tax ? `Temp. ${a.tax} °C` : '',
    a.spo2 ? `SpO₂ ${a.spo2}%${cond}` : '', a.hgt ? `Glicemia ${a.hgt}` : '', a.glasgow ? `Glasgow ${a.glasgow}` : '',
    a.peso ? `Peso ${a.peso} kg` : '',
  ].filter(Boolean).join(' · ')
}

// Peso deste atendimento (ponto 11 do plantonista): o que a prescrição exige
// (private.peso_do_atendimento) e o que as folhas do leito imprimem. Usado no
// "Novo item" da prescrição e no topo da aba Prescrição do leito.
import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabase'
import { dataHora } from '@/lib/formato'
import type { FaltaParaPrescrever } from '@/lib/buscaMedicamento'
import { gravarRegistros, novoItem } from '@/lib/offline/sincronizar'

// como o peso foi obtido (observacao.metodo); nulo = aferido
export const METODOS_PESO = [
  { v: 'aferido', rotulo: 'Aferido' }, { v: 'estimado', rotulo: 'Estimado' }, { v: 'referido', rotulo: 'Referido pelo paciente' },
] as const
export type MetodoPeso = (typeof METODOS_PESO)[number]['v']
export const rotuloMetodoPeso = (m: string | null) => (m && m !== 'aferido' ? METODOS_PESO.find((x) => x.v === m)?.rotulo.toLowerCase() ?? m : null)

/** Grava o peso deste atendimento (observação, autor = login). Devolve o erro, ou null. */
export async function gravarPeso(perfilId: string | undefined, pacienteId: string, texto: string, metodo: MetodoPeso): Promise<string | null> {
  const n = Number(texto.replace(',', '.'))
  if (!perfilId) return 'Entre de novo para registrar o peso.'
  if (!(n > 0)) return 'Escreva o peso em kg.'
  const { data: c } = await supabase.from('conceito').select('id').eq('nome', 'peso').is('unidade_id', null).single()
  if (!c) return 'Conceito de peso não encontrado.'
  const r = await gravarRegistros(perfilId, [novoItem('observacao', {
    paciente_id: pacienteId, conceito_id: c.id, valor_num: n, origem: 'manual', metodo,
  })])
  return r.recusados[0] ?? null
}

/** O peso deste atendimento e o que falta para prescrever, como o servidor vê. */
export function useFaltaParaPrescrever(pacienteId: string | null | undefined) {
  return useQuery({
    queryKey: ['falta-prescrever', pacienteId],
    enabled: !!pacienteId,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('o_que_falta_para_prescrever', { p_paciente: pacienteId! })
      if (error) throw error
      return data as unknown as FaltaParaPrescrever
    },
  })
}

/** Frase do peso: o deste atendimento, ou o antigo marcado como de outro atendimento. */
export function textoDoPeso(f: FaltaParaPrescrever | undefined): string | null {
  if (f?.peso) return `Peso deste atendimento: ${f.peso.valor} kg${rotuloMetodoPeso(f.peso.metodo) ? `, ${rotuloMetodoPeso(f.peso.metodo)}` : ''} (${dataHora(f.peso.em)})`
  if (f?.peso_anterior) return `Peso de outro atendimento: ${f.peso_anterior.valor} kg (${dataHora(f.peso_anterior.em)}). Registre o de hoje.`
  return null
}

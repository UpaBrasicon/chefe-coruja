import { supabase } from '@/lib/supabase'
import { criarLoteador, type RespostaLote } from '@/lib/loteador'

// Item 08 do kit de desempenho: leituras por paciente que as listas pediam uma
// a uma (painel de observação, checagem da enfermagem). Os pedidos do mesmo
// instante vão juntos numa chamada (migration 20270320000001); cada paciente
// recebe o mesmo que a função de um paciente devolve.
const MAXIMO = 200

export const loteAlergias = criarLoteador<unknown>(async (ids) => {
  const { data, error } = await supabase.rpc('alergias_dos_pacientes', { p_pacientes: ids })
  if (error) throw error
  return (data ?? {}) as RespostaLote<unknown>
}, { maximo: MAXIMO })

export const loteAcuidade = criarLoteador<unknown>(async (ids) => {
  const { data, error } = await supabase.rpc('acuidade_dos_pacientes', { p_pacientes: ids })
  if (error) throw error
  return (data ?? {}) as RespostaLote<unknown>
}, { maximo: MAXIMO })

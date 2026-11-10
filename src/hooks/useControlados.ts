// Medicação controlada (lacuna 3, migration 20270324000001): leituras comuns
// às telas. A marca é do banco (gatilho no catálogo); aqui só se lê.
//  - useControladosDoCatalogo: os itens marcados do catálogo, por id (poucas
//    dezenas de linhas, em cache: serve à prescrição, à farmácia e à receita);
//  - useSubstanciasControladas: a tabela da RDC, para o item escrito à mão;
//  - useControleDosItens: a lista de cada item de prescrição, para as telas
//    que só têm o item (validação, painel da farmácia);
//  - useDestinoNaReceita: para onde vai o item da receita para casa.
import { useQuery } from '@tanstack/react-query'

import { controleDoCatalogo, controleDoItem, destinoDoItem, ehLista, ehReceita, type Controle, type SubstanciaControlada } from '@/domain/controlados'
import { supabase } from '@/lib/supabase'

const DEZ_MINUTOS = 10 * 60_000

export function useControladosDoCatalogo() {
  return useQuery({
    queryKey: ['controlados-catalogo'],
    staleTime: DEZ_MINUTOS,
    queryFn: async () => {
      const { data, error } = await supabase.from('medicamento')
        .select('id, controlado_lista, controlado_substancia, controlado_receita').not('controlado_lista', 'is', null)
      if (error) throw error
      const mapa = new Map<string, Controle>()
      for (const m of data ?? []) {
        const c = controleDoCatalogo(m)
        if (c) mapa.set(m.id, c)
      }
      return mapa
    },
  })
}

export function useSubstanciasControladas() {
  return useQuery({
    queryKey: ['substancias-controladas'],
    staleTime: DEZ_MINUTOS,
    queryFn: async () => {
      const { data, error } = await supabase.from('substancias_controladas')
        .select('substancia, chave, grafias, lista, item, receita, adendo').eq('vigente', true)
      if (error) throw error
      return (data ?? []).flatMap((s): SubstanciaControlada[] =>
        ehLista(s.lista) && ehReceita(s.receita) ? [{ ...s, lista: s.lista, receita: s.receita, grafias: s.grafias ?? [] }] : [])
    },
  })
}

export function useControleDosItens(itens: string[]) {
  return useQuery({
    queryKey: ['controle-dos-itens', itens.join(',')],
    enabled: itens.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('controle_dos_itens', { p_itens: itens })
      if (error) throw error
      const mapa = new Map<string, Controle>()
      for (const e of (data ?? []) as unknown as { item_id: string; lista: string; substancia: string | null; receita: string | null }[]) {
        const c = controleDoCatalogo(e)
        if (c) mapa.set(e.item_id, c)
      }
      return mapa
    },
  })
}

/** Receita para casa: o controle e o destino de cada item (cadastro ou nome escrito). */
export function useDestinoNaReceita() {
  const catalogo = useControladosDoCatalogo().data
  const tabela = useSubstanciasControladas().data
  return {
    /** as duas leituras chegaram: antes disso, não se emite */
    pronto: !!catalogo && !!tabela,
    controle: (nome: string, medicamentoId: string | null) => controleDoItem(nome, medicamentoId, catalogo, tabela),
    destino: (nome: string, medicamentoId: string | null, marcadoAMao = false) =>
      destinoDoItem(controleDoItem(nome, medicamentoId, catalogo, tabela), marcadoAMao),
  }
}

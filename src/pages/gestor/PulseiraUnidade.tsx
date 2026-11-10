// Pulseira de identificação (lacuna 2): não é obrigatória em toda unidade
// (RT, 10/11/2026). O gestor liga aqui; desligada, os botões de imprimir somem
// e o servidor recusa a impressão (definir_pulseira_unidade).
import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { Chip } from '@/components/monitor/Pagina'
import { supabase } from '@/lib/supabase'

export function PulseiraUnidade({ unidadeId, atual }: { unidadeId: string; atual: boolean }) {
  const qc = useQueryClient()
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)

  async function definir(usa: boolean) {
    if (usa === atual || salvando) return
    setSalvando(true)
    const { error } = await supabase.rpc('definir_pulseira_unidade', { p_unidade: unidadeId, p_usa: usa })
    setSalvando(false)
    if (error) return setErro(error.message)
    setErro(null)
    // os vínculos trazem usa_pulseira: os botões aparecem ou somem sem recarregar
    void qc.invalidateQueries()
  }

  return (
    <div className="flex min-w-0 flex-col gap-[3px]">
      <span id="pulseira-unidade" className="text-apoio font-medium text-grafite">Pulseira de identificação</span>
      <div className="flex gap-1.5" role="radiogroup" aria-labelledby="pulseira-unidade">
        <Chip radio ativo={atual} desabilitado={salvando} onClick={() => void definir(true)}>Usa</Chip>
        <Chip radio ativo={!atual} desabilitado={salvando} onClick={() => void definir(false)}>Não usa</Chip>
      </div>
      {erro && <span role="alert" className="text-rotulo text-critico">{erro}</span>}
      {!erro && (
        <span className="text-rotulo text-tinta-sussurro">
          {atual ? 'A recepção imprime a pulseira ao abrir a ficha.' : 'Os botões de imprimir pulseira não aparecem.'}
        </span>
      )}
    </div>
  )
}

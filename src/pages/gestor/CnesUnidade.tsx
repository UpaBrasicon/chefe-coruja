// CNES da unidade (decisão do RT de 10/10/2026): cada unidade tem o seu,
// preenchido pelo gestor. Vai em toda linha do BPA. O servidor confere os 7
// dígitos e que o número não está em outra unidade (definir_cnes_unidade).
import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { supabase } from '@/lib/supabase'

export function CnesUnidade({ unidadeId, atual }: { unidadeId: string; atual: string | null }) {
  const qc = useQueryClient()
  const [valor, setValor] = React.useState(atual ?? '')
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const digitos = valor.replace(/\D/g, '')
  const pronto = digitos.length === 7 && digitos !== (atual ?? '')

  async function salvar() {
    setSalvando(true)
    const { error } = await supabase.rpc('definir_cnes_unidade', { p_unidade: unidadeId, p_cnes: digitos })
    setSalvando(false)
    if (error) return setErro(error.message)
    setErro(null)
    void qc.invalidateQueries()
  }

  return (
    <div className="flex min-w-0 flex-col gap-[3px]">
      <label htmlFor="cnes-unidade" className="text-apoio font-medium text-grafite">CNES</label>
      <div className="flex gap-2">
        <Input id="cnes-unidade" className="h-8 w-32" inputMode="numeric" maxLength={9} placeholder="7 dígitos"
          value={valor} onChange={(e) => setValor(e.target.value)} />
        <Button size="sm" variant="outline" disabled={!pronto || salvando} onClick={() => void salvar()}>Salvar</Button>
      </div>
      {erro && <span role="alert" className="text-xs text-critico">{erro}</span>}
      {!atual && !erro && <span className="text-xs text-tinta-sussurro">Sem o CNES, o BPA não fecha.</span>}
    </div>
  )
}

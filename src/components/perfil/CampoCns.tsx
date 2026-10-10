// CNS do profissional (Fase 3, tarefa 3): vai em toda linha do BPA-I que o
// profissional fez. Conferido pelo dígito aqui e de novo no servidor
// (definir_meu_cns).
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cnsValido } from '@/lib/documentos'
import { supabase } from '@/lib/supabase'

export function CampoCns({ inicial }: { inicial: string | null }) {
  const [atual, setAtual] = React.useState<string | null>(inicial)
  const [valor, setValor] = React.useState(inicial ?? '')
  const [erro, setErro] = React.useState<string | null>(null)
  const [salvando, setSalvando] = React.useState(false)
  const digitos = valor.replace(/\D/g, '')
  const mudou = digitos !== (atual ?? '')
  const invalido = digitos.length > 0 && !cnsValido(digitos)

  async function salvar() {
    setSalvando(true)
    const { data, error } = await supabase.rpc('definir_meu_cns', { p_cns: digitos })
    setSalvando(false)
    if (error) return setErro(error.message)
    setErro(null); setAtual(data ?? null)
  }

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <Label htmlFor="perf-cns">Cartão SUS (CNS) — vai no BPA</Label>
      <div className="flex gap-2">
        <Input id="perf-cns" inputMode="numeric" maxLength={18} value={valor} placeholder="15 dígitos"
          aria-invalid={invalido || undefined} onChange={(e) => setValor(e.target.value)} />
        <Button type="button" variant="outline" disabled={!mudou || invalido || salvando} onClick={() => void salvar()}>Salvar</Button>
      </div>
      {invalido && <span className="text-xs text-atencao">O número não confere: são 15 dígitos com o dígito verificador do Ministério da Saúde.</span>}
      {!atual && !invalido && <span className="text-xs text-tinta-sussurro">Sem o CNS, o que você fizer não entra no BPA.</span>}
      {erro && <span role="alert" className="text-xs text-critico">{erro}</span>}
    </div>
  )
}

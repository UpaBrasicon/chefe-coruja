// Campo do peso deste atendimento, com o modo de obtenção (ponto 11 do
// plantonista). Usado no "Novo item" da prescrição e no cabeçalho da folha do
// leito (PM2). Grava pela mesma gravarPeso (observação, autor = login).
import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { useAuth } from '@/contexts/AuthContext'
import { Chip } from '@/components/monitor/Pagina'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { METODOS_PESO, gravarPeso, type MetodoPeso } from '@/components/prescricao/pesoAtendimento'

export function CampoPeso({ pacienteId, motivo, aoGravar, aoErro, id = 'peso-novo' }: {
  pacienteId: string; motivo?: string; aoGravar: () => void; aoErro: (m: string | null) => void; id?: string
}) {
  const { perfil } = useAuth()
  const qc = useQueryClient()
  const [valor, setValor] = React.useState('')
  const [metodo, setMetodo] = React.useState<MetodoPeso>('aferido')
  const [gravando, setGravando] = React.useState(false)
  async function registrar() {
    setGravando(true)
    const erro = await gravarPeso(perfil?.id, pacienteId, valor, metodo)
    setGravando(false)
    if (erro) return aoErro(erro)
    setValor(''); setMetodo('aferido'); aoErro(null)
    for (const k of ['falta-prescrever', 'peso-atual']) void qc.invalidateQueries({ queryKey: [k, pacienteId] })
    aoGravar()
  }
  return (
    <div className="flex flex-wrap items-end gap-2">
      {motivo && <span className="w-full text-rotulo text-atencao">{motivo}</span>}
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>Peso deste atendimento (kg)</Label>
        <Input id={id} className="h-8 w-28 tabular-nums" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void registrar() } }} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Como o peso foi obtido">
        {METODOS_PESO.map((m) => <Chip key={m.v} ativo={metodo === m.v} onClick={() => setMetodo(m.v)}>{m.rotulo}</Chip>)}
      </div>
      <Button size="sm" disabled={gravando || !valor.trim()} onClick={() => void registrar()}>Registrar peso</Button>
    </div>
  )
}

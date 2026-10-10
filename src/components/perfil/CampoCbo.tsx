// CBO do médico (Fase 3, tarefa 2): entra no laudo de AIH e é conferido pela
// crítica "cbo" — na lista oficial (terminologia.cbo). O servidor confere de
// novo (definir_meu_cbo).
import { useQuery } from '@tanstack/react-query'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

type Cbo = { codigo: string; titulo: string }

export function CampoCbo({ inicial }: { inicial: string | null }) {
  const [atual, setAtual] = React.useState<string | null>(inicial)
  const [termo, setTermo] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)
  const titulo = useQuery({
    queryKey: ['cbo-titulo', atual],
    enabled: !!atual,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_cbo', { p_termo: atual! })
      if (error) throw error
      return ((data ?? []) as unknown as Cbo[]).find((c) => c.codigo === atual)?.titulo ?? null
    },
  })
  const busca = useQuery({
    queryKey: ['buscar-cbo', termo.trim()],
    enabled: termo.trim().length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('buscar_cbo', { p_termo: termo.trim() })
      if (error) throw error
      return (data ?? []) as unknown as Cbo[]
    },
  })

  async function escolher(codigo: string) {
    const { error } = await supabase.rpc('definir_meu_cbo', { p_cbo: codigo })
    if (error) return setErro(error.message)
    setErro(null); setAtual(codigo); setTermo('')
  }

  return (
    <div className="flex flex-col gap-1.5 sm:col-span-2">
      <Label htmlFor="perf-cbo">CBO (ocupação) — vai no laudo de AIH</Label>
      {atual && (
        <span className="text-apoio text-tinta">{atual}{titulo.data ? ` · ${titulo.data}` : ''}</span>
      )}
      <Input id="perf-cbo" value={termo} onChange={(e) => setTermo(e.target.value)}
        placeholder={atual ? 'Trocar: digite o código ou a ocupação (ex.: médico clínico)' : 'Digite o código ou a ocupação (ex.: 225125 ou médico clínico)'} />
      {(busca.data ?? []).length > 0 && (
        <div className="flex max-h-48 flex-col overflow-y-auto rounded-md border border-fio">
          {(busca.data ?? []).map((c) => (
            <Button key={c.codigo} type="button" variant="ghost" size="sm" className="justify-start" onClick={() => void escolher(c.codigo)}>
              {c.codigo} · {c.titulo}
            </Button>
          ))}
        </div>
      )}
      {termo.trim().length >= 2 && busca.data && busca.data.length === 0 && (
        <span className="text-xs text-tinta-sussurro">Nada encontrado na lista oficial do CBO.</span>
      )}
      {erro && <span role="alert" className="text-xs text-critico">{erro}</span>}
    </div>
  )
}

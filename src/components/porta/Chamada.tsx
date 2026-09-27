import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Megaphone, UserX } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import { useSalas } from '@/hooks/useChamadas'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Chamada e saída da fila (Fase 2.3). Três chamadas sem resposta geram um
// aviso; tirar da fila é sempre decisão de quem chamou, com justificativa.

const chaveSala = (setor: string, etapa: string) => `cc-sala:${setor}:${etapa}`

export function BotaoChamar({
  episodioId,
  setorId,
  etapa,
  chamadas,
}: {
  episodioId: string
  setorId: string
  etapa: 'triagem' | 'atendimento'
  chamadas: number
}) {
  const queryClient = useQueryClient()
  const { data: salas } = useSalas(setorId)
  const doTipo = (salas ?? []).filter((s) => (etapa === 'triagem' ? s.tipo === 'triagem' : s.tipo !== 'triagem'))
  const [salaId, setSalaId] = React.useState<string>(() => {
    try {
      return localStorage.getItem(chaveSala(setorId, etapa)) ?? ''
    } catch {
      return ''
    }
  })
  const sala = doTipo.find((s) => s.id === salaId) ?? doTipo[0]

  const chamar = useMutation({
    mutationFn: async () => {
      if (!sala) throw new Error('Nenhuma sala nesta porta.')
      const { data, error } = await supabase.rpc('chamar_paciente', { p_episodio: episodioId, p_sala: sala.id })
      if (error) throw error
      return data as { numero: number; aviso: boolean }
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['chamadas-contagem'] }),
  })

  return (
    <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <select
        aria-label="Sala"
        className="h-8 rounded-controle border border-fio bg-superficie px-2 text-xs"
        value={sala?.id ?? ''}
        onChange={(e) => {
          setSalaId(e.target.value)
          try {
            localStorage.setItem(chaveSala(setorId, etapa), e.target.value)
          } catch {
            // sem armazenamento: vale só nesta tela
          }
        }}
      >
        {doTipo.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
      </select>
      <Button size="sm" variant="outline" disabled={chamar.isPending || !sala} onClick={() => chamar.mutate()}>
        <Megaphone /> {chamadas > 0 ? `Chamar de novo · ${chamadas} ${chamadas === 1 ? 'chamada' : 'chamadas'}` : 'Chamar'}
      </Button>
      {chamar.error && <span className="text-xs text-destructive">{(chamar.error as Error).message}</span>}
    </div>
  )
}

const MOTIVOS = [
  { valor: 'evasao', rotulo: 'Evadiu' },
  { valor: 'duplicada', rotulo: 'Ficha duplicada' },
  { valor: 'engano', rotulo: 'Aberta por engano' },
] as const

export function RetirarDaFila({ episodioId, aviso }: { episodioId: string; aviso: boolean }) {
  const queryClient = useQueryClient()
  const [aberto, setAberto] = React.useState(false)
  const [motivo, setMotivo] = React.useState<(typeof MOTIVOS)[number]['valor']>('evasao')
  const [just, setJust] = React.useState('')
  const retirar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('retirar_da_fila', { p_episodio: episodioId, p_motivo: motivo, p_justificativa: just })
      if (error) throw error
    },
    onSuccess: () => {
      setAberto(false)
      void queryClient.invalidateQueries()
    },
  })

  return (
    <div className="flex flex-col gap-2" onClick={(e) => e.stopPropagation()}>
      {aviso && !aberto && (
        <p role="status" className="text-xs text-atencao">
          Chamado 3 vezes sem resposta. Mantenha na fila ou registre a evasão.
        </p>
      )}
      {!aberto ? (
        <Button size="sm" variant="ghost" className="self-start" onClick={() => setAberto(true)}>
          <UserX /> Retirar da fila
        </Button>
      ) : (
        <div className="flex flex-col gap-2 rounded-controle border border-fio p-2">
          <div className="flex flex-wrap gap-1">
            {MOTIVOS.map((m) => (
              <Button key={m.valor} size="sm" variant={motivo === m.valor ? 'default' : 'outline'} onClick={() => setMotivo(m.valor)}>
                {m.rotulo}
              </Button>
            ))}
          </div>
          <Input aria-label="Justificativa" placeholder="Justificativa (mínimo de 15 letras)" value={just} onChange={(e) => setJust(e.target.value)} />
          {retirar.error && <span className="text-xs text-destructive">{(retirar.error as Error).message}</span>}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Manter na fila</Button>
            <Button size="sm" variant="destructive" disabled={just.trim().length < 15 || retirar.isPending} onClick={() => retirar.mutate()}>
              Retirar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

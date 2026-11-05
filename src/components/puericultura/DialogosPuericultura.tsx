// Puericultura (nota C2, item 15): a saída à mão da criança (mudança de
// território ou de equipe, óbito) e o desfazer. As RPCs (migration
// 20270224000001) só aceitam o médico ou o enfermeiro da UBS.
import { useMutation, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase'

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

export function DialogoRetirarCrianca({ pacienteId, nome, onFechar }: { pacienteId: string; nome: string; onFechar: () => void }) {
  const qc = useQueryClient()
  const [motivo, setMotivo] = React.useState('')
  const retirar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('puericultura_retirar', { p_paciente: pacienteId, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['puericultura'] }); onFechar() },
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retirar da puericultura</DialogTitle>
          <DialogDescription>{nome} sai do painel. Use para mudança de território ou de equipe e para óbito; aos 2 anos a criança sai sozinha.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="puericultura-retirar-motivo">Motivo</Label>
          <Input id="puericultura-retirar-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: mudou de território" />
        </div>
        {retirar.error && <p role="alert" className="text-apoio text-critico">{msg(retirar.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Voltar</Button>
          <Button variant="destructive" disabled={motivo.trim().length < 5 || retirar.isPending} onClick={() => retirar.mutate()}>Retirar</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Volta ao painel a criança retirada por engano. */
export function BotaoDesfazerSaida({ pacienteId }: { pacienteId: string }) {
  const qc = useQueryClient()
  const desfazer = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('puericultura_desfazer_saida', { p_paciente: pacienteId })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['puericultura'] }),
  })
  return (
    <>
      <Button size="xs" variant="outline" disabled={desfazer.isPending} onClick={() => desfazer.mutate()}>Voltar à puericultura</Button>
      {desfazer.error && <span role="alert" className="text-apoio text-critico">{msg(desfazer.error)}</span>}
    </>
  )
}

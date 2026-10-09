import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FileWarning } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { contingenciasDoAtendimento, type Contingencia, type Reentrada } from '@/lib/contingencia'
import { fmtDataHora } from '@/lib/datas'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

// Marca "reentrada de contingência" no atendimento (Fase 1, tarefa 12): o que
// foi feito no papel durante a contingência e depois digitado/anexado aqui.
// Mostra as marcas já feitas e, se houver contingência que alcance este
// atendimento, o botão para marcar (migration 20261030000006).

export function ReentradaContingencia({ unidadeId, episodioId, chegadaEm }: { unidadeId: string; episodioId: string; chegadaEm: string }) {
  const queryClient = useQueryClient()
  const [aberto, setAberto] = React.useState(false)
  const [contingencia, setContingencia] = React.useState('')
  const [descricao, setDescricao] = React.useState('')

  const marcas = useQuery({
    queryKey: ['reentradas', episodioId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('reentradas_do_episodio', { p_episodio: episodioId })
      if (error) throw error
      return data as unknown as Reentrada[]
    },
  })
  const contingencias = useQuery({
    queryKey: ['contingencias', unidadeId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('contingencias_da_unidade', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as Contingencia[]
    },
  })
  const cabem = contingenciasDoAtendimento(contingencias.data ?? [], chegadaEm)

  const marcar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('marcar_reentrada_contingencia', { p_episodio: episodioId, p_contingencia: contingencia, p_descricao: descricao.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      setAberto(false); setDescricao('')
      void queryClient.invalidateQueries({ queryKey: ['reentradas', episodioId] })
      void queryClient.invalidateQueries({ queryKey: ['contingencias', unidadeId] })
    },
  })

  if ((marcas.data ?? []).length === 0 && cabem.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {(marcas.data ?? []).map((m) => (
        <div key={m.id} role="note" className="flex items-start gap-2 rounded-container border border-atencao/30 bg-atencao/[0.06] px-3 py-2 text-apoio text-atencao">
          <FileWarning className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            <strong className="font-semibold">Reentrada de contingência</strong> ({fmtDataHora(m.inicio)} a {fmtDataHora(m.fim)}): {m.descricao}
            <span className="text-tinta-sussurro"> · marcado por {m.registrado_por ?? '—'} em {fmtDataHora(m.registrado_em)}</span>
          </span>
        </div>
      ))}
      {cabem.length > 0 && (
        <div>
          <Button size="sm" variant="outline" onClick={() => { setAberto(true); setContingencia(cabem[0].id); marcar.reset() }}>
            <FileWarning /> Marcar reentrada de contingência
          </Button>
        </div>
      )}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="text-dialogo">Reentrada de contingência</DialogTitle>
            <DialogDescription className="text-controle">
              Anexe as folhas de papel ao prontuário e digite o essencial (classificação, prescrição vigente, desfecho). Aqui fica a marca de que esses registros vieram do papel, com a hora real.
            </DialogDescription>
          </DialogHeader>
          <div role="radiogroup" aria-label="Contingência" className="flex flex-col gap-1.5">
            {cabem.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={contingencia === c.id} onClick={() => setContingencia(c.id)}
                className={cn('rounded-lg border px-3 py-2 text-left text-apoio', contingencia === c.id ? 'border-marca ring-1 ring-marca' : 'border-fio')}>
                {fmtDataHora(c.inicio)} a {fmtDataHora(c.fim)} · “{c.motivo}”
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`reentrada-${episodioId}`}>O que veio do papel</Label>
            <Textarea id={`reentrada-${episodioId}`} rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: classificação amarela às 08:40 e prescrição no papel (ficha C-03, anexada)" />
            <span className="text-rotulo text-tinta-sussurro">Mínimo de 10 letras, com a hora real dos registros.</span>
          </div>
          {marcar.error && <p role="alert" className="text-apoio text-critico">{(marcar.error as Error).message}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAberto(false)}>Cancelar</Button>
            <Button disabled={!contingencia || descricao.trim().length < 10 || marcar.isPending} onClick={() => marcar.mutate()}>
              <FileWarning /> Marcar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

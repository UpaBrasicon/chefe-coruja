import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Megaphone, Trash2, UserX } from 'lucide-react'
import * as React from 'react'

import { SeletorMotivoEvasao } from '@/components/porta/MotivoEvasao'
import type { MotivoEvasao } from '@/lib/evasao'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'
import { useSalas } from '@/hooks/useChamadas'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

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
      {chamar.error && <span className="text-xs text-critico">{(chamar.error as Error).message}</span>}
    </div>
  )
}

const MOTIVOS = [
  { valor: 'evasao', rotulo: 'Evadiu' },
  { valor: 'duplicada', rotulo: 'Ficha duplicada' },
  { valor: 'engano', rotulo: 'Aberta por engano' },
] as const

type Motivo = (typeof MOTIVOS)[number]['valor']

function useRetirar(episodioId: string, aoTerminar: () => void) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ motivo, just, motivoEvasao }: { motivo: Motivo; just: string; motivoEvasao: MotivoEvasao | null }) => {
      const { error } = await supabase.rpc('retirar_da_fila', { p_episodio: episodioId, p_motivo: motivo, p_justificativa: just })
      if (error) throw error
      // Fase 1, tarefa 6: o motivo de lista da evasão (migration 20261029000006)
      if (motivo === 'evasao' && motivoEvasao) {
        const { error: e2 } = await supabase.rpc('registrar_motivo_evasao', { p_episodio: episodioId, p_motivo: motivoEvasao })
        if (e2) throw e2
      }
    },
    onSuccess: () => {
      aoTerminar()
      void queryClient.invalidateQueries()
    },
  })
}

export function RetirarDaFila({ episodioId, aviso }: { episodioId: string; aviso: boolean }) {
  const [aberto, setAberto] = React.useState(false)
  const [motivo, setMotivo] = React.useState<Motivo>('evasao')
  const [motivoEvasao, setMotivoEvasao] = React.useState<MotivoEvasao | null>(null)
  const [just, setJust] = React.useState('')
  const retirar = useRetirar(episodioId, () => setAberto(false))
  const faltaMotivo = motivo === 'evasao' && !motivoEvasao

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
          {motivo === 'evasao' && <SeletorMotivoEvasao valor={motivoEvasao} onChange={setMotivoEvasao} />}
          <Input aria-label="Justificativa" placeholder="Justificativa (mínimo de 15 letras)" value={just} onChange={(e) => setJust(e.target.value)} />
          {retirar.error && <span className="text-xs text-critico">{(retirar.error as Error).message}</span>}
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Manter na fila</Button>
            <Button size="sm" variant="destructive" disabled={just.trim().length < 15 || faltaMotivo || retirar.isPending} onClick={() => retirar.mutate({ motivo, just, motivoEvasao })}>
              Retirar
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Lixeira da fila com o diálogo "Excluir da fila" (protótipo, excl.*): motivo,
 * justificativa de 15 caracteres ou mais, e o registro fica no histórico com
 * o motivo e quem excluiu (retirar_da_fila).
 */
export function ExcluirDaFila({ episodioId, nome }: { episodioId: string; nome: string }) {
  const [aberto, setAberto] = React.useState(false)
  const [motivo, setMotivo] = React.useState<Motivo>('evasao')
  const [motivoEvasao, setMotivoEvasao] = React.useState<MotivoEvasao | null>(null)
  const [just, setJust] = React.useState('')
  const [tentou, setTentou] = React.useState(false)
  const retirar = useRetirar(episodioId, () => setAberto(false))
  const curta = just.trim().length < 15
  const faltaMotivo = motivo === 'evasao' && !motivoEvasao

  function abrir(v: boolean) {
    setAberto(v)
    if (v) {
      setMotivo('evasao')
      setMotivoEvasao(null)
      setJust('')
      setTentou(false)
      retirar.reset()
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={abrir}>
      <Button
        type="button"
        variant="outline"
        size="icon-lg"
        title="Excluir da fila com justificativa"
        aria-label={`Excluir ${nome} da fila`}
        className="text-tinta-sussurro hover:border-critico hover:bg-alerta-critico hover:text-critico"
        onClick={() => abrir(true)}
      >
        <Trash2 />
      </Button>
      <DialogContent className="sm:max-w-[480px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle className="text-dialogo">Excluir da fila</DialogTitle>
          <DialogDescription className="text-controle">
            {nome} sai da fila e o registro fica no histórico do plantão com o motivo e quem excluiu.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-[7px]">
          <span className="text-apoio font-medium text-grafite">Motivo</span>
          <div role="radiogroup" aria-label="Motivo" className="flex flex-wrap gap-[7px]">
            {MOTIVOS.map((m) => (
              <button
                key={m.valor}
                type="button"
                role="radio"
                aria-checked={motivo === m.valor}
                onClick={() => setMotivo(m.valor)}
                className={cn(
                  'min-h-9 rounded-capsula border px-[13px] text-apoio whitespace-nowrap transition-colors',
                  motivo === m.valor ? 'border-marca bg-marca/10 font-medium text-acao' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao',
                )}
              >
                {m.rotulo}
              </button>
            ))}
          </div>
        </div>
        {motivo === 'evasao' && <SeletorMotivoEvasao valor={motivoEvasao} onChange={setMotivoEvasao} invalido={tentou && faltaMotivo} />}
        <div className="flex flex-col gap-[5px]">
          <Label htmlFor={`excl-just-${episodioId}`} className="text-apoio font-medium text-grafite">Justificativa</Label>
          <Textarea
            id={`excl-just-${episodioId}`}
            rows={3}
            value={just}
            onChange={(e) => setJust(e.target.value)}
            placeholder="O que aconteceu, com horário"
            aria-invalid={tentou && curta}
          />
          <span className={cn('text-rotulo', tentou && curta ? 'text-critico' : 'text-tinta-sussurro')}>Mínimo de 15 caracteres.</span>
        </div>
        {retirar.error && <p role="alert" className="text-apoio text-critico">{(retirar.error as Error).message}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-9" onClick={() => abrir(false)}>Cancelar</Button>
          <Button
            type="button"
            className="min-h-9 bg-critico hover:bg-[#991B1B]"
            disabled={retirar.isPending}
            onClick={() => {
              setTentou(true)
              if (!curta && !faltaMotivo) retirar.mutate({ motivo, just: just.trim(), motivoEvasao })
            }}
          >
            <Trash2 /> Excluir da fila
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

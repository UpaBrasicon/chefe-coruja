import { useQueryClient } from '@tanstack/react-query'
import { BedSingle, Lock, LockOpen, Sparkles } from 'lucide-react'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
import type { StatusLeito } from '@/types/database'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { MOTIVOS_BLOQUEIO, type MotivoBloqueio } from '@/components/leito/motivos'

// Fase 0, tarefas 6 e 7 (migration 20261024000001): o status do leito só muda
// pelas RPCs. Higienização: enfermagem e gestor. Bloqueio/desbloqueio: gestor e
// enfermeiro, com motivo. Leito ocupado não se bloqueia (o banco recusa).

type Props = {
  leitoId: string
  identificador: string
  status: StatusLeito
  podeHigienizar: boolean
  podeBloquear: boolean
  /** gestor: leito "ocupado" sem internação (dado antigo) vai para higienização */
  podeLiberarSemPaciente?: boolean
  /** cartão pequeno (Setores): só ícones */
  compacto?: boolean
  /** chaves de consulta a reler depois da ação */
  invalidar: unknown[][]
  onErro?: (mensagem: string) => void
}

export function AcoesLeito({ leitoId, identificador, status, podeHigienizar, podeBloquear, podeLiberarSemPaciente, compacto, invalidar, onErro }: Props) {
  const queryClient = useQueryClient()
  const [ocupado, setOcupado] = React.useState(false)
  const [dialogo, setDialogo] = React.useState<'bloquear' | 'liberar' | null>(null)
  const [motivo, setMotivo] = React.useState<MotivoBloqueio | ''>('')
  const [observacao, setObservacao] = React.useState('')
  const [erro, setErro] = React.useState<string | null>(null)

  const reler = () => invalidar.forEach((k) => void queryClient.invalidateQueries({ queryKey: k }))

  async function executar(fn: () => PromiseLike<{ error: { message: string } | null }>) {
    setOcupado(true)
    const { error } = await fn()
    setOcupado(false)
    if (error) {
      onErro?.(error.message)
      return false
    }
    reler()
    return true
  }

  async function bloquear() {
    if (!motivo) { setErro('Escolha o motivo.'); return }
    if (motivo === 'outro' && observacao.trim().length < 5) { setErro('Descreva o motivo.'); return }
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.rpc('bloquear_leito', {
      p_leito: leitoId, p_motivo: motivo, p_observacao: observacao.trim() || undefined,
    })
    setOcupado(false)
    if (error) { setErro(error.message); return }
    setDialogo(null)
    reler()
  }

  async function liberarSemPaciente() {
    if (observacao.trim().length < 5) { setErro('Escreva o motivo.'); return }
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.rpc('liberar_leito_sem_paciente', { p_leito: leitoId, p_motivo: observacao.trim() })
    setOcupado(false)
    if (error) { setErro(error.message); return }
    setDialogo(null)
    reler()
  }

  return (
    <div className="flex items-center gap-0.5">
      {status === 'higienizacao' && podeHigienizar && (
        <Button
          variant={compacto ? 'ghost' : 'outline'}
          size={compacto ? 'icon-xs' : 'xs'}
          aria-label={`Higienização do leito ${identificador} concluída`}
          title="Higienização concluída"
          disabled={ocupado}
          onClick={() => void executar(() => supabase.rpc('concluir_higienizacao', { p_leito: leitoId }))}
        >
          {ocupado ? <Spinner /> : <Sparkles />}{!compacto && ' Higienizado'}
        </Button>
      )}
      {(status === 'livre' || status === 'higienizacao') && podeBloquear && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Bloquear leito ${identificador}`}
          title="Bloquear leito"
          disabled={ocupado}
          onClick={() => { setMotivo(''); setObservacao(''); setErro(null); setDialogo('bloquear') }}
        >
          <Lock />
        </Button>
      )}
      {status === 'bloqueado' && podeBloquear && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Desbloquear leito ${identificador}`}
          title="Desbloquear leito"
          disabled={ocupado}
          onClick={() => {
            if (window.confirm(`Desbloquear o leito ${identificador}? Ele volta a ficar livre.`)) {
              void executar(() => supabase.rpc('desbloquear_leito', { p_leito: leitoId }))
            }
          }}
        >
          {ocupado ? <Spinner /> : <LockOpen />}
        </Button>
      )}

      {status === 'ocupado' && podeLiberarSemPaciente && (
        <Button
          variant="ghost"
          size="icon-xs"
          aria-label={`Liberar leito ${identificador} sem paciente`}
          title="Leito sem paciente? Liberar"
          disabled={ocupado}
          onClick={() => { setObservacao(''); setErro(null); setDialogo('liberar') }}
        >
          <BedSingle />
        </Button>
      )}

      <Dialog open={dialogo === 'liberar'} onOpenChange={(o) => { if (!o) setDialogo(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Liberar leito {identificador} sem paciente</DialogTitle>
            <DialogDescription>
              Use só quando o leito aparece ocupado mas não há paciente nele. Com paciente, o banco recusa: libere pela
              alta ou pela transferência. O leito vai para higienização e o motivo fica registrado.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`motivo-liberar-${leitoId}`} className="text-apoio font-medium text-grafite">Motivo</label>
            <Textarea
              id={`motivo-liberar-${leitoId}`}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              maxLength={300}
            />
          </div>
          {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
          <DialogFooter>
            <Button onClick={() => void liberarSemPaciente()} disabled={ocupado}>
              {ocupado && <Spinner />} Liberar leito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogo === 'bloquear'} onOpenChange={(o) => { if (!o) setDialogo(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquear leito {identificador}</DialogTitle>
            <DialogDescription>
              O leito sai da lista de livres até ser desbloqueado. O motivo fica registrado.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-apoio font-medium text-grafite">Motivo</legend>
            {(Object.keys(MOTIVOS_BLOQUEIO) as MotivoBloqueio[]).map((m) => (
              <label key={m} className="flex items-center gap-2 text-apoio text-tinta">
                <input
                  type="radio"
                  name={`motivo-bloqueio-${leitoId}`}
                  value={m}
                  checked={motivo === m}
                  onChange={() => { setMotivo(m); setErro(null) }}
                  className="size-4"
                />
                {MOTIVOS_BLOQUEIO[m]}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`obs-bloqueio-${leitoId}`} className="text-apoio font-medium text-grafite">
              {motivo === 'outro' ? 'Descreva o motivo' : 'Observação (opcional)'}
            </label>
            <Textarea
              id={`obs-bloqueio-${leitoId}`}
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={2}
              maxLength={300}
            />
          </div>
          {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
          <DialogFooter>
            <Button onClick={() => void bloquear()} disabled={ocupado}>
              {ocupado && <Spinner />} Bloquear leito
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

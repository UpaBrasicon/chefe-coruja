import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as React from 'react'

import { supabase } from '@/lib/supabase'
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

// Reserva de leito (Fase 0, item 12; decisões do responsável em 07/10/2026):
// para um paciente da unidade OU por motivo livre; validade de 1, 2, 4 ou 8 h.
// O banco confere quem pode reservar e que o leito está livre.

const HORAS_RESERVA = [1, 2, 4, 8] as const

type Achado = { id: string; nome: string; nome_social: string | null; data_nascimento: string | null }

export function ReservarLeito({ aberto, onFechar, leitoId, identificador, unidadeId, invalidar }: {
  aberto: boolean
  onFechar: () => void
  leitoId: string
  identificador: string
  unidadeId: string
  invalidar: unknown[][]
}) {
  const queryClient = useQueryClient()
  const [modo, setModo] = React.useState<'paciente' | 'motivo'>('paciente')
  const [busca, setBusca] = React.useState('')
  const [paciente, setPaciente] = React.useState<Achado | null>(null)
  const [motivo, setMotivo] = React.useState('')
  const [horas, setHoras] = React.useState<number>(2)
  const [erro, setErro] = React.useState<string | null>(null)
  const [ocupado, setOcupado] = React.useState(false)

  const termo = busca.trim()
  const achados = useQuery({
    queryKey: ['reserva-busca-paciente', unidadeId, termo],
    enabled: aberto && modo === 'paciente' && termo.length >= 3 && !paciente,
    queryFn: async (): Promise<Achado[]> => {
      const { data, error } = await supabase.rpc('buscar_pacientes', { p_unidade: unidadeId, p_termo: termo })
      if (error) throw error
      return (data ?? []).slice(0, 8)
    },
  })

  async function reservar() {
    if (modo === 'paciente' && !paciente) { setErro('Escolha o paciente.'); return }
    if (modo === 'motivo' && motivo.trim().length < 5) { setErro('Descreva o motivo da reserva.'); return }
    setErro(null)
    setOcupado(true)
    const { error } = await supabase.rpc('reservar_leito', {
      p_leito: leitoId,
      p_horas: horas,
      p_paciente: modo === 'paciente' ? paciente!.id : undefined,
      p_motivo: modo === 'motivo' ? motivo.trim() : undefined,
    })
    setOcupado(false)
    if (error) { setErro(error.message); return }
    invalidar.forEach((k) => void queryClient.invalidateQueries({ queryKey: k }))
    onFechar()
  }

  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reservar leito {identificador}</DialogTitle>
          <DialogDescription>
            O leito fica guardado e só o paciente da reserva pode ocupá-lo. Passado o prazo, a reserva expira e o leito volta a livre.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Button size="sm" variant={modo === 'paciente' ? 'default' : 'outline'} onClick={() => { setModo('paciente'); setErro(null) }}>Para um paciente</Button>
          <Button size="sm" variant={modo === 'motivo' ? 'default' : 'outline'} onClick={() => { setModo('motivo'); setErro(null) }}>Por motivo</Button>
        </div>
        {modo === 'paciente' ? (
          paciente ? (
            <div className="flex items-center justify-between rounded-controle border border-fio px-3 py-2 text-apoio">
              <span className="font-medium text-tinta">{paciente.nome_social || paciente.nome}</span>
              <Button size="xs" variant="ghost" onClick={() => setPaciente(null)}>Trocar</Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={`busca-reserva-${leitoId}`} className="text-apoio font-medium text-grafite">Paciente (nome, CPF, CNS ou prontuário)</label>
              <input
                id={`busca-reserva-${leitoId}`}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                autoComplete="off"
                className="min-h-10 rounded-controle border border-fio bg-campo px-3 text-controle outline-none focus-visible:border-marca"
              />
              {achados.isLoading && <Spinner />}
              <ul className="flex flex-col">
                {(achados.data ?? []).map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => setPaciente(a)} className="w-full rounded-controle px-2 py-1.5 text-left text-apoio hover:bg-campo">
                      {a.nome_social || a.nome}
                      {a.data_nascimento && <span className="text-tinta-sussurro"> · {new Date(a.data_nascimento + 'T12:00').toLocaleDateString('pt-BR')}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              {termo.length >= 3 && achados.data?.length === 0 && <p className="text-apoio text-tinta-sussurro">Nenhum paciente encontrado.</p>}
            </div>
          )
        ) : (
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`motivo-reserva-${leitoId}`} className="text-apoio font-medium text-grafite">Motivo (ex.: transferência externa chegando)</label>
            <Textarea id={`motivo-reserva-${leitoId}`} value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={2} maxLength={300} />
          </div>
        )}
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="mb-1 text-apoio font-medium text-grafite">Validade</legend>
          {HORAS_RESERVA.map((h) => (
            <Button key={h} size="sm" variant={horas === h ? 'default' : 'outline'} onClick={() => setHoras(h)}>{h} h</Button>
          ))}
        </fieldset>
        {erro && <p role="alert" className="text-apoio text-critico">{erro}</p>}
        <DialogFooter>
          <Button onClick={() => void reservar()} disabled={ocupado}>{ocupado && <Spinner />} Reservar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

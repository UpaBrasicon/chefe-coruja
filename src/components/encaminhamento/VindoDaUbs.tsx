// "Vindo da UBS" na recepção da UPA (5A, tarefa 5, parte 5.2; H1 do RT): os
// pacientes que a UBS da rede enviou, com o resumo da consulta. A recepção abre
// a ficha como sempre e marca a chegada ligando à ficha; ou registra que não
// chegou. Sem registro em 12 horas, o servidor marca "não chegou" sozinho (e a
// recepção ainda corrige).
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ambulance, LogIn, UserX } from 'lucide-react'
import * as React from 'react'

import { Estado } from '@/components/porta/Estado'
import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { SITUACAO_ENVIO, nomeDoEnvio, type EnvioUpa } from '@/domain/encaminhamento'
import { rotuloIdade } from '@/domain/idade'
import { dataIso, hora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
export type FichaDoDia = { episodio_id: string; nome: string; nome_social: string | null; chegada_em: string }

export function VindoDaUbs({ unidadeId, fichas }: { unidadeId: string; fichas: FichaDoDia[] }) {
  const lista = useQuery({
    queryKey: ['encaminhamentos-upa', 'destino', unidadeId],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('encaminhamentos_upa_destino', { p_unidade: unidadeId })
      if (error) throw error
      return (data ?? []) as unknown as EnvioUpa[]
    },
  })
  const [chegada, setChegada] = React.useState<EnvioUpa | null>(null)
  const [naoChegou, setNaoChegou] = React.useState<EnvioUpa | null>(null)
  const envios = lista.data ?? []
  if (envios.length === 0) return null
  const hoje = dataIso()
  return (
    <section aria-label="Vindo da UBS" className="mb-4 flex flex-col gap-2 rounded-cartao border border-atencao/30 bg-alerta-atencao/40 px-4 py-3">
      <span className="flex items-center gap-2 text-controle font-semibold text-tinta"><Ambulance className="size-4 text-atencao" aria-hidden /> Vindo da UBS</span>
      <ul className="flex flex-col divide-y divide-fio">
        {envios.map((e) => {
          const p = e.resumo.paciente
          const aguarda = e.situacao === 'enviado' || (e.situacao === 'nao_chegou' && !e.chegada_por)
          return (
            <li key={e.id} className="flex flex-wrap items-start gap-x-3 gap-y-1.5 py-2">
              <div className="flex min-w-0 flex-[1_1_260px] flex-col">
                <span className="text-controle text-tinta">
                  <strong>{nomeDoEnvio(e)}</strong>
                  <span className="text-apoio text-tinta-sussurro">{p.data_nascimento ? ` · ${rotuloIdade(p.data_nascimento, hoje)}` : ''}{p.cns ? ` · CNS ${p.cns}` : ''}</span>
                </span>
                <span className="text-apoio text-tinta-apoio">{e.unidade_origem} · {e.motivo}</span>
                {e.resumo.soap?.avaliacao && <span className="text-rotulo text-tinta-sussurro">Avaliação na UBS: {e.resumo.soap.avaliacao}{e.resumo.soap.cid ? ` · CID ${e.resumo.soap.cid}` : ''}</span>}
                <span className="text-rotulo text-tinta-sussurro">Enviado às {hora(e.enviado_em)}{e.enviado_por ? ` por ${e.enviado_por}` : ''}</span>
              </div>
              <Estado tom={SITUACAO_ENVIO[e.situacao].tom}>{SITUACAO_ENVIO[e.situacao].rotulo}</Estado>
              {aguarda && (
                <div className="flex gap-1.5">
                  <Button size="sm" onClick={() => setChegada(e)}><LogIn /> Chegou</Button>
                  {e.situacao === 'enviado' && <Button size="sm" variant="outline" onClick={() => setNaoChegou(e)}><UserX /> Não chegou</Button>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {chegada && <DialogoChegou e={chegada} fichas={fichas} onFechar={() => setChegada(null)} />}
      {naoChegou && <DialogoNaoChegou e={naoChegou} onFechar={() => setNaoChegou(null)} />}
    </section>
  )
}

function DialogoChegou({ e, fichas, onFechar }: { e: EnvioUpa; fichas: FichaDoDia[]; onFechar: () => void }) {
  const qc = useQueryClient()
  const nome = nomeDoEnvio(e)
  // a ficha de hoje com o mesmo nome vem marcada; a recepção confere
  const mesmoNome = fichas.find((f) => (f.nome_social || f.nome).trim().toLowerCase() === nome.trim().toLowerCase())
  const [ficha, setFicha] = React.useState(mesmoNome?.episodio_id ?? '')
  const marcar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('encaminhamento_upa_marcar_chegada', { p_id: e.id, p_chegou: true, p_episodio: ficha || undefined })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['encaminhamentos-upa'] }); onFechar() },
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chegou: {nome}</DialogTitle>
          <DialogDescription>Abra a ficha como sempre (Nova ficha) e escolha-a aqui; a UBS fica sabendo que o paciente chegou.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chegou-ficha">Ficha aberta hoje</Label>
          <CampoSelecao id="chegou-ficha" value={ficha} onChange={(ev) => setFicha(ev.target.value)}>
            <option value="">Ainda sem ficha</option>
            {fichas.map((f) => <option key={f.episodio_id} value={f.episodio_id}>{f.nome_social || f.nome} · {hora(f.chegada_em)}</option>)}
          </CampoSelecao>
        </div>
        {marcar.error && <p role="alert" className="text-apoio text-critico">{msg(marcar.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Voltar</Button>
          <Button disabled={marcar.isPending} onClick={() => marcar.mutate()}><LogIn /> Registrar a chegada</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DialogoNaoChegou({ e, onFechar }: { e: EnvioUpa; onFechar: () => void }) {
  const qc = useQueryClient()
  const [obs, setObs] = React.useState('')
  const marcar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('encaminhamento_upa_marcar_chegada', { p_id: e.id, p_chegou: false, p_observacao: obs.trim() })
      if (error) throw error
    },
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ['encaminhamentos-upa'] }); onFechar() },
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Não chegou: {nomeDoEnvio(e)}</DialogTitle>
          <DialogDescription>Quem enviou na {e.unidade_origem} é avisado.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nao-chegou-obs">O que aconteceu</Label>
          <Textarea id="nao-chegou-obs" rows={2} value={obs} onChange={(ev) => setObs(ev.target.value)} />
          <span className="text-rotulo text-tinta-sussurro">Mínimo de 10 letras.</span>
        </div>
        {marcar.error && <p role="alert" className="text-apoio text-critico">{msg(marcar.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Voltar</Button>
          <Button variant="destructive" disabled={obs.trim().length < 10 || marcar.isPending} onClick={() => marcar.mutate()}>Registrar que não chegou</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// "Enviar à UPA" (5A, tarefa 5; H1 e H5 do RT): da consulta ou da escuta
// inicial da UBS, o médico ou o enfermeiro escolhe a UPA (ou o hospital) da rede
// e escreve o motivo. O servidor (encaminhar_upa) tira o resumo da consulta,
// avisa a UPA e começa o prazo de 12 horas para a chegada.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ambulance } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { CampoSelecao } from '@/components/ui/campo-selecao'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase'

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

export function EnviarUpa({ aberto, onFechar, episodioId, unidadeId, nome, motivoInicial = '', onEnviado }: {
  aberto: boolean; onFechar: () => void; episodioId: string; unidadeId: string; nome: string
  motivoInicial?: string
  onEnviado: (aviso: string) => void
}) {
  const qc = useQueryClient()
  const [destino, setDestino] = React.useState('')
  const [motivo, setMotivo] = React.useState(motivoInicial)
  // as unidades da rede (a mesma lista do destino da regulação); o servidor só
  // aceita UPA ou hospital
  const rede = useQuery({
    queryKey: ['regulacao-contexto', unidadeId],
    enabled: aberto && !!unidadeId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('regulacao_contexto', { p_unidade: unidadeId })
      if (error) throw error
      return data as unknown as { unidades_rede: { id: string; nome: string }[] }
    },
  })
  const opcoes = (rede.data?.unidades_rede ?? []).filter((u) => u.id !== unidadeId)
  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('encaminhar_upa', { p_episodio: episodioId, p_destino: destino, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      const u = opcoes.find((o) => o.id === destino)?.nome ?? 'UPA'
      void qc.invalidateQueries({ queryKey: ['encaminhamentos-upa'] })
      onEnviado(`${nome}: enviado à ${u}. A UPA foi avisada; acompanhe em Encaminhados.`)
    },
  })
  return (
    <Dialog open={aberto} onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar à UPA: {nome}</DialogTitle>
          <DialogDescription>
            A UPA recebe o aviso com o resumo da consulta (queixa, último SOAP, sinais). Se a chegada não for registrada em 12 horas, você é avisado.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="envio-destino">UPA ou hospital da rede</Label>
          <CampoSelecao id="envio-destino" value={destino} onChange={(e) => setDestino(e.target.value)}>
            <option value="">Escolha…</option>
            {opcoes.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
          </CampoSelecao>
          {rede.error && <span className="text-rotulo text-critico">{msg(rede.error)}</span>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="envio-motivo">Motivo do envio</Label>
          <Textarea id="envio-motivo" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <span className="text-rotulo text-tinta-sussurro">Mínimo de 10 letras. Fora da rede, use a folha de encaminhamento (aba Encaminhar).</span>
        </div>
        {enviar.error && <p role="alert" className="text-apoio text-critico">{msg(enviar.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Voltar</Button>
          <Button disabled={!destino || motivo.trim().length < 10 || enviar.isPending} onClick={() => enviar.mutate()}>
            <Ambulance /> Enviar à UPA
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

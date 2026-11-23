// Atendimentos de outros dias não encerrados (limpeza do percurso da UBS, LP3
// = A do RT em 23/11/2026). A ficha que o médico abriu e não encerrou pela
// conduta trava a ficha nova do paciente. Ninguém fecha sozinho: o gestor da
// UBS vê a lista e encerra com motivo, pelo login dele
// (public.ubs_encerrar_nao_concluido, migration 20270415000036). O encerramento
// não vai ao SISAB nem à RNDS e não conta na produção.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { data, hora } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

type NaoEncerrado = {
  episodio_id: string; paciente_id: string; nome: string; nome_social: string | null
  chegada_em: string; iniciado_em: string; quem_abriu: string | null; setor: string
}
const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))

export function AtendimentosNaoEncerrados({ unidadeId }: { unidadeId: string }) {
  const q = useQuery({
    queryKey: ['ubs-nao-encerrados', unidadeId],
    queryFn: async () => {
      const { data: d, error } = await supabase.rpc('ubs_atendimentos_nao_encerrados', { p_unidade: unidadeId })
      if (error) throw error
      return (d ?? []) as unknown as NaoEncerrado[]
    },
  })
  const [encerrar, setEncerrar] = React.useState<NaoEncerrado | null>(null)
  if (!q.data || q.data.length === 0) return null
  return (
    <section aria-label="Atendimentos de outros dias não encerrados" className="flex flex-col gap-2.5 rounded-cartao border border-atencao/30 bg-superficie px-4 py-3">
      <span className="flex items-center gap-1.5 text-controle font-semibold text-atencao">
        <TriangleAlert className="size-4" aria-hidden /> Atendimentos de outros dias não encerrados ({q.data.length})
      </span>
      <p className="text-apoio text-tinta-apoio">
        O médico ou o enfermeiro que abriu encerra pela conduta. Se não houver como concluir, o gestor encerra com motivo; o paciente fica liberado para ficha nova, e o registro não vai ao SISAB.
      </p>
      <ul className="flex flex-col">
        {q.data.map((a) => (
          <li key={a.episodio_id} className="flex flex-wrap items-center gap-3 border-t border-trilha py-2 text-apoio text-tinta">
            <span className="min-w-0 flex-1">
              <strong className="font-semibold">{a.nome_social || a.nome}</strong>
              <span className="block text-rotulo text-tinta-sussurro">
                iniciado em {data(a.iniciado_em)} às {hora(a.iniciado_em)}{a.quem_abriu ? ` por ${a.quem_abriu}` : ''} · {a.setor}
              </span>
            </span>
            <Button size="sm" variant="outline" onClick={() => setEncerrar(a)}>Encerrar sem concluir</Button>
          </li>
        ))}
      </ul>
      {encerrar && <DialogoEncerrar a={encerrar} unidadeId={unidadeId} onFechar={() => setEncerrar(null)} />}
    </section>
  )
}

function DialogoEncerrar({ a, unidadeId, onFechar }: { a: NaoEncerrado; unidadeId: string; onFechar: () => void }) {
  const qc = useQueryClient()
  const [motivo, setMotivo] = React.useState('')
  const enviar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('ubs_encerrar_nao_concluido', { p_episodio: a.episodio_id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['ubs-nao-encerrados', unidadeId] })
      onFechar()
    },
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Encerrar sem concluir: {a.nome_social || a.nome}</DialogTitle>
          <DialogDescription>
            Atendimento iniciado em {data(a.iniciado_em)} às {hora(a.iniciado_em)}{a.quem_abriu ? ` por ${a.quem_abriu}` : ''}. O encerramento fica com o seu nome, como atendimento não concluído.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nao-concluido-motivo">Motivo</Label>
          <Textarea id="nao-concluido-motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ex.: paciente saiu antes de concluir; médico sem acesso para registrar" />
        </div>
        {enviar.error && <p role="alert" className="text-apoio text-critico">{msg(enviar.error)}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onFechar}>Voltar</Button>
          <Button disabled={motivo.trim().length < 10 || enviar.isPending} onClick={() => enviar.mutate()}>Encerrar sem concluir</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

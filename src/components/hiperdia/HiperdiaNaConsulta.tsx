// Hiperdia na consulta da UBS (5A, tarefa 7, parte 7.2; J2, J4 e J5 do RT em
// 03/11/2026): os programas do paciente e o que está atrasado pela régua das
// notas C5 e C4; incluir e retirar à mão; e a avaliação dos pés (C4-F), que se
// registra aqui. O problema "hipertensão" ou "diabetes" marcado na conduta
// inclui sozinho quando a consulta encerra. Só médico, enfermagem e gestor veem.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Footprints, HeartPulse, Plus, X } from 'lucide-react'
import * as React from 'react'

import { Chip } from '@/components/monitor/Pagina'
import { SeloPrograma } from '@/components/hiperdia/SeloPrograma'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ITENS, ROTULO_PROGRAMA, estadoDoItem, type HiperdiaRegistros, type Programa, type ProgramaAtivo } from '@/domain/hiperdia'
import { useAgora } from '@/hooks/useAgora'
import { data } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
type DoPaciente = HiperdiaRegistros & { programas: ProgramaAtivo[] }

export function HiperdiaNaConsulta({ pacienteId, episodioId }: { pacienteId: string; episodioId: string }) {
  const qc = useQueryClient()
  const agora = useAgora(60_000)
  const q = useQuery({
    queryKey: ['hiperdia', 'paciente', pacienteId],
    retry: false,
    queryFn: async () => {
      const { data: d, error } = await supabase.rpc('hiperdia_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return d as unknown as DoPaciente
    },
  })
  const invalidar = () => void qc.invalidateQueries({ queryKey: ['hiperdia'] })
  const incluir = useMutation({
    mutationFn: async (programa: Programa) => {
      const { error } = await supabase.rpc('programa_incluir', { p_paciente: pacienteId, p_programa: programa })
      if (error) throw error
    },
    onSuccess: invalidar,
  })
  const [retirar, setRetirar] = React.useState<ProgramaAtivo | null>(null)
  // quem não vê o hiperdia (recepção) não recebe o bloco
  if (q.error || !q.data) return null
  const h = q.data
  const ativos = h.programas.map((p) => p.programa)
  const pendentes = ITENS.map((i) => ({ i, e: estadoDoItem(h, i.item, agora) })).filter(({ e }) => e === 'atrasado' || e === 'sem_registro')

  return (
    <section aria-label="Hiperdia" className="flex flex-col gap-2.5 rounded-container border border-fio px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-controle font-semibold text-tinta"><HeartPulse className="size-4 text-acao" aria-hidden /> Hiperdia</span>
        {h.programas.map((p) => (
          <span key={p.id} className="flex items-center gap-0.5">
            <SeloPrograma programa={p.programa} />
            <Button size="icon-xs" variant="ghost" aria-label={`Retirar do programa de ${ROTULO_PROGRAMA[p.programa].toLowerCase()}`} onClick={() => setRetirar(p)}><X /></Button>
          </span>
        ))}
        {h.programas.length === 0 && <span className="text-apoio text-tinta-sussurro">fora do programa</span>}
        {(['hipertensao', 'diabetes'] as const).filter((p) => !ativos.includes(p)).map((p) => (
          <Button key={p} size="xs" variant="outline" disabled={incluir.isPending} onClick={() => incluir.mutate(p)}><Plus /> {ROTULO_PROGRAMA[p]}</Button>
        ))}
      </div>
      {incluir.error && <p role="alert" className="text-apoio text-critico">{msg(incluir.error)}</p>}
      {h.programas.length > 0 && pendentes.length > 0 && (
        <p className="text-apoio text-tinta-apoio">
          <span className="text-atencao">Pendente: </span>
          {pendentes.map(({ i, e }) => {
            const iso = i.campo ? (h[i.campo] as string | null) : null
            return `${i.rotulo}${e === 'atrasado' && iso ? ` (última ${data(iso)})` : ' (sem registro)'}`
          }).join(' · ')}
        </p>
      )}
      {h.programas.length > 0 && pendentes.length === 0 && <p className="text-apoio text-conforme">Em dia no que o app registra.</p>}
      {ativos.includes('diabetes') && <AvaliacaoPes episodioId={episodioId} ultima={h.ultima_avaliacao_pes} onFeito={invalidar} />}
      {retirar && <DialogoRetirar p={retirar} onFechar={() => setRetirar(null)} onFeito={invalidar} />}
    </section>
  )
}

function AvaliacaoPes({ episodioId, ultima, onFeito }: { episodioId: string; ultima: string | null; onFeito: () => void }) {
  const [resultado, setResultado] = React.useState<'sem_alteracao' | 'com_alteracao' | null>(null)
  const [obs, setObs] = React.useState('')
  const [feito, setFeito] = React.useState(false)
  const registrar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('registrar_avaliacao_pes', { p_episodio: episodioId, p_resultado: resultado!, p_observacao: obs.trim() || undefined })
      if (error) throw error
    },
    onSuccess: () => { setFeito(true); onFeito() },
  })
  if (feito) return <p role="status" className="text-apoio text-conforme">Avaliação dos pés registrada nesta consulta.</p>
  return (
    <div className="flex flex-col gap-1.5 border-t border-fio pt-2.5">
      <span className="flex items-center gap-1.5 text-apoio font-medium text-tinta"><Footprints className="size-3.5" aria-hidden /> Avaliação dos pés
        <span className="font-normal text-tinta-sussurro">{ultima ? `· última em ${data(ultima)}` : '· nunca registrada'}</span></span>
      <div role="radiogroup" aria-label="Resultado da avaliação dos pés" className="flex flex-wrap gap-2">
        <Chip variante="opcao" radio ativo={resultado === 'sem_alteracao'} onClick={() => setResultado('sem_alteracao')}>Sem alteração</Chip>
        <Chip variante="opcao" radio ativo={resultado === 'com_alteracao'} onClick={() => setResultado('com_alteracao')}>Com alteração</Chip>
      </div>
      {resultado === 'com_alteracao' && (
        <div className="flex flex-col gap-1">
          <Label htmlFor="pes-alteracao">Qual alteração</Label>
          <Textarea id="pes-alteracao" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: perda da sensibilidade protetora no pé direito" />
        </div>
      )}
      {registrar.error && <p role="alert" className="text-apoio text-critico">{msg(registrar.error)}</p>}
      <div>
        <Button size="xs" variant="outline" disabled={!resultado || (resultado === 'com_alteracao' && obs.trim().length < 5) || registrar.isPending}
          onClick={() => registrar.mutate()}>Registrar a avaliação dos pés</Button>
      </div>
    </div>
  )
}

function DialogoRetirar({ p, onFechar, onFeito }: { p: ProgramaAtivo; onFechar: () => void; onFeito: () => void }) {
  const [motivo, setMotivo] = React.useState('')
  const retirar = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('programa_retirar', { p_participante: p.id, p_motivo: motivo.trim() })
      if (error) throw error
    },
    onSuccess: () => { onFeito(); onFechar() },
  })
  return (
    <Dialog open onOpenChange={(o) => { if (!o) onFechar() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retirar do programa de {ROTULO_PROGRAMA[p.programa].toLowerCase()}</DialogTitle>
          <DialogDescription>O paciente sai do painel do hiperdia. Se a consulta registrar a condição de novo, ele volta sozinho.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="retirar-motivo">Motivo</Label>
          <Input id="retirar-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: diagnóstico revisto" />
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

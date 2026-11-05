// Pré-natal na consulta da UBS (5A, tarefa 7; K2, K4 e K5 do RT em 05/11/2026,
// opção B da tela): a gestação ativa com a linha do tempo, o que perdeu o prazo
// e o que está a fazer pela nota C3; registrar ou corrigir a DUM, o fim da
// gestação e a saída. Com "pré-natal" (ou o CID/CIAP de gestação) marcado e a
// paciente fora do programa, o bloco pede a DUM e inclui já (K2: a DUM passa a
// ser pedida na consulta); sem a DUM, a consulta inclui sozinha ao encerrar.
// Só médico, enfermagem e gestor veem; registrar é do médico e do enfermeiro.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Baby } from 'lucide-react'
import * as React from 'react'

import { PesoAltura } from '@/components/hiperdia/HiperdiaNaConsulta'
import { CampoDum, DialogoDesfecho, DialogoDum, DialogoRetirar } from '@/components/preNatal/Dialogos'
import { LinhaDoTempo } from '@/components/preNatal/LinhaDoTempo'
import { Button } from '@/components/ui/button'
import { useUnidade } from '@/contexts/UnidadeContext'
import {
  ROTULO_FASE, TETO_NO_APP, diaDoPuerperio, diasEntre, faseDa, frasesDa, pontosDa, rotuloIG, estadoDoItem, type Gestacao,
} from '@/domain/preNatal'
import { dataIso } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

const msg = (e: unknown) => (e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e))
const dataBr = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

export function PreNatalNaConsulta({ pacienteId, episodioId, nomePaciente, marcouGestacao }: {
  pacienteId: string; episodioId: string; nomePaciente: string
  /** a conduta desta consulta tem "pré-natal" ou o CID/CIAP de gestação */
  marcouGestacao: boolean
}) {
  const qc = useQueryClient()
  const { papeisDaUnidade } = useUnidade()
  const podeEditar = papeisDaUnidade.includes('plantonista') || papeisDaUnidade.includes('enfermeiro')
  const hoje = dataIso()
  const q = useQuery({
    queryKey: ['pre-natal', 'paciente', pacienteId],
    retry: false,
    queryFn: async () => {
      const { data: d, error } = await supabase.rpc('pre_natal_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return ((d as { gestacao: Gestacao | null } | null)?.gestacao ?? null)
    },
  })
  const [dum, setDum] = React.useState('')
  const incluir = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('pre_natal_incluir', { p_paciente: pacienteId, p_dum: dum, p_episodio: episodioId })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['pre-natal'] }),
  })
  const [acao, setAcao] = React.useState<'dum' | 'desfecho' | 'retirar' | null>(null)
  // quem não vê o pré-natal (recepção) não recebe o bloco
  if (q.error || q.isLoading) return null
  const g = q.data ?? null

  if (!g) {
    if (!marcouGestacao) return null
    return (
      <section aria-label="Pré-natal" className="flex flex-col gap-2.5 rounded-container border border-fio px-4 py-3">
        <span className="flex items-center gap-1.5 text-controle font-semibold text-tinta"><Baby className="size-4 text-acao" aria-hidden /> Pré-natal</span>
        <p className="text-apoio text-tinta-apoio">A gestante entra no pré-natal quando esta consulta encerrar. Registre a DUM para o painel saber a semana e os prazos.</p>
        {podeEditar && (
          <div className="flex flex-wrap items-end gap-2">
            <CampoDum id="consulta-pre-natal-dum" valor={dum} onMudar={setDum} />
            <Button size="xs" variant="outline" disabled={!dum || dum > hoje || incluir.isPending} onClick={() => incluir.mutate()}>Incluir com a DUM</Button>
          </div>
        )}
        {incluir.error && <p role="alert" className="text-apoio text-critico">{msg(incluir.error)}</p>}
      </section>
    )
  }

  const fase = faseDa(g, hoje)
  const { perdido, aFazer } = frasesDa(g, hoje)
  const pendePesoAltura = g.dum && fase !== 'puerperio' && estadoDoItem(g, 'peso_altura', hoje) === 'no_prazo'
  return (
    <section aria-label="Pré-natal" className="flex flex-col gap-2.5 rounded-container border border-fio px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5 text-controle font-semibold text-tinta"><Baby className="size-4 text-acao" aria-hidden /> Pré-natal</span>
        <span className="rounded-capsula bg-alerta-marca px-2 py-0.5 text-rotulo font-medium text-marca-escura">
          {fase === 'puerperio' ? `Puerpério · dia ${diaDoPuerperio(g, hoje) ?? 0} de 42` : ROTULO_FASE[fase]}
        </span>
        {g.dum && fase !== 'puerperio' && <span className="text-apoio text-tinta-apoio">IG {rotuloIG(diasEntre(g.dum, hoje))} · DPP {dataBr(g.dpp!)}</span>}
        {g.desfecho === 'parto' && g.desfecho_em && <span className="text-apoio text-tinta-apoio">parto em {dataBr(g.desfecho_em)}</span>}
        {g.dum && <span className="text-apoio text-tinta-sussurro">{pontosDa(g, hoje)} de {TETO_NO_APP} pontos</span>}
      </div>
      {g.dum ? (
        <>
          <LinhaDoTempo g={g} hoje={hoje} />
          {perdido.length > 0 && <p className="text-apoio text-critico">{perdido.join(' · ')}</p>}
          {aFazer.length > 0 && <p className="text-apoio text-tinta-apoio"><span className="text-atencao">A fazer: </span>{aFazer.join(' · ')}</p>}
          <p className="text-rotulo text-tinta-sussurro">consultas {g.consultas ?? 0}/7 · pressão {g.pa ?? 0}/7 · peso e altura {g.peso_altura ?? 0}/7 na gestação</p>
        </>
      ) : (
        <p className="text-apoio text-atencao">Sem a DUM, o app não sabe a semana da gestação nem os prazos da régua.</p>
      )}
      {podeEditar && (
        <div className="flex flex-wrap gap-2">
          <Button size="xs" variant="outline" onClick={() => setAcao('dum')}>{g.dum ? 'Corrigir a DUM' : 'Registrar a DUM'}</Button>
          {fase !== 'puerperio' && <Button size="xs" variant="outline" onClick={() => setAcao('desfecho')}>Fim da gestação</Button>}
          <Button size="xs" variant="ghost" onClick={() => setAcao('retirar')}>Retirar do pré-natal</Button>
        </div>
      )}
      {podeEditar && pendePesoAltura && (
        <PesoAltura pacienteId={pacienteId} prefixo="pre-natal" onFeito={() => void qc.invalidateQueries({ queryKey: ['pre-natal'] })} />
      )}
      {acao === 'dum' && <DialogoDum g={g} nome={nomePaciente} onFechar={() => setAcao(null)} />}
      {acao === 'desfecho' && <DialogoDesfecho g={g} nome={nomePaciente} onFechar={() => setAcao(null)} />}
      {acao === 'retirar' && <DialogoRetirar g={g} nome={nomePaciente} onFechar={() => setAcao(null)} />}
    </section>
  )
}

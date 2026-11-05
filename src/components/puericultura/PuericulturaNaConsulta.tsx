// Puericultura na consulta da UBS (5A, tarefa 7; K6 = A do RT em 05/11/2026):
// para a criança com menos de 2 anos, a linha do tempo, a 1ª consulta e as
// contas da nota C2. Conta para a régua a consulta com o problema
// "Puericultura" marcado na conduta. Peso e altura pendentes também se
// registram aqui. Só médico, enfermagem e gestor veem; retirar é do médico e
// do enfermeiro.
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Sprout } from 'lucide-react'
import * as React from 'react'

import { PesoAltura } from '@/components/hiperdia/HiperdiaNaConsulta'
import { BotaoDesfazerSaida, DialogoRetirarCrianca } from '@/components/puericultura/DialogosPuericultura'
import { LinhaDoTempoCrianca } from '@/components/puericultura/LinhaDoTempoCrianca'
import { Button } from '@/components/ui/button'
import { useUnidade } from '@/contexts/UnidadeContext'
import { META, TETO_NO_APP, estadoDoItem, frasesDa, pontosDa, rotuloIdadeCurta, type DoPaciente } from '@/domain/puericultura'
import { dataIso } from '@/lib/formato'
import { supabase } from '@/lib/supabase'

export function PuericulturaNaConsulta({ pacienteId, nomePaciente, marcouPuericultura }: {
  pacienteId: string; nomePaciente: string
  /** a conduta desta consulta tem o problema "Puericultura" */
  marcouPuericultura: boolean
}) {
  const qc = useQueryClient()
  const { papeisDaUnidade } = useUnidade()
  const podeEditar = papeisDaUnidade.includes('plantonista') || papeisDaUnidade.includes('enfermeiro')
  const hoje = dataIso()
  const q = useQuery({
    queryKey: ['puericultura', 'paciente', pacienteId],
    retry: false,
    queryFn: async () => {
      const { data: d, error } = await supabase.rpc('puericultura_do_paciente', { p_paciente: pacienteId })
      if (error) throw error
      return d as unknown as DoPaciente
    },
  })
  const [retirar, setRetirar] = React.useState(false)
  // quem não vê (recepção) e quem não é criança de até 2 anos não recebem o bloco
  if (q.error || !q.data || !q.data.crianca) return null
  const c = q.data
  const titulo = <span className="flex items-center gap-1.5 text-controle font-semibold text-tinta"><Sprout className="size-4 text-acao" aria-hidden /> Puericultura</span>

  if (c.saida) {
    return (
      <section aria-label="Puericultura" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-container border border-fio px-4 py-3">
        {titulo}
        <span className="text-apoio text-tinta-apoio">Fora do painel: {c.saida.motivo}</span>
        {podeEditar && <BotaoDesfazerSaida pacienteId={pacienteId} />}
      </section>
    )
  }

  const { perdido, aFazer } = frasesDa(c, hoje)
  return (
    <section aria-label="Puericultura" className="flex flex-col gap-2.5 rounded-container border border-fio px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {titulo}
        <span className="text-apoio text-tinta-apoio">{rotuloIdadeCurta(c.data_nascimento, hoje)}</span>
        <span className="text-apoio text-tinta-sussurro">{pontosDa(c, hoje)} de {TETO_NO_APP} pontos</span>
      </div>
      <LinhaDoTempoCrianca c={c} hoje={hoje} />
      {perdido.length > 0 && <p className="text-apoio text-critico">{perdido.join(' · ')}</p>}
      {aFazer.length > 0 && <p className="text-apoio text-tinta-apoio"><span className="text-atencao">A fazer: </span>{aFazer.join(' · ')}</p>}
      <p className="text-rotulo text-tinta-sussurro">consultas {c.consultas}/{META} · peso e altura {c.peso_altura}/{META} até os 2 anos</p>
      {!marcouPuericultura && (
        <p className="text-apoio text-atencao">Para contar na régua, marque o problema "Puericultura" nesta consulta.</p>
      )}
      {podeEditar && estadoDoItem(c, 'peso_altura', hoje) === 'no_prazo' && (
        <PesoAltura pacienteId={pacienteId} prefixo="puericultura" onFeito={() => void qc.invalidateQueries({ queryKey: ['puericultura'] })} />
      )}
      {podeEditar && <div><Button size="xs" variant="ghost" onClick={() => setRetirar(true)}>Retirar da puericultura</Button></div>}
      {retirar && <DialogoRetirarCrianca pacienteId={pacienteId} nome={nomePaciente} onFechar={() => setRetirar(false)} />}
    </section>
  )
}

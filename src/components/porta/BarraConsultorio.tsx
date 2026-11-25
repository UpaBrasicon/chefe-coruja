import { useQuery } from '@tanstack/react-query'
import { MapPin } from 'lucide-react'
import * as React from 'react'

import { Button } from '@/components/ui/button'

import { Chip } from '@/components/monitor/Pagina'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import type { useConsultorioDoPlantao } from '@/hooks/useConsultorioDoPlantao'
import { portasComConsultorio, rotulosCurtos, type PortaComConsultorio, type SalaDaPorta } from '@/lib/barraConsultorio'
import { supabase } from '@/lib/supabase'

// Barra do consultório acima das abas da fila do PS, no molde da barra da sala da
// triagem (revisão visual 3.4): escolhida uma vez no plantão, vale para todas as
// chamadas.
// BT1 (revisão das telas novas, RT 25/11/2026): uma linha só. Entram só os
// setores da escala que têm consultório; antes cada setor da escala ganhava a
// sua linha e quem estava também na Clínica Médica, na Observação e na Sala
// Vermelha lia "Nenhum consultório cadastrado nesta porta" três vezes.

type Consultorio = ReturnType<typeof useConsultorioDoPlantao>

function LinhaDaPorta({ porta, consultorio, comSetor }: { porta: PortaComConsultorio; consultorio: Consultorio; comSetor: boolean }) {
  const [trocando, setTrocando] = React.useState(false)
  const { setor, consultorios } = porta
  const atual = consultorios.find((s) => s.id === consultorio.salas[setor])
  const curtos = rotulosCurtos(consultorios.map((s) => s.nome))
  const onde = comSetor && porta.setorNome ? `${porta.setorNome} · ` : ''
  // M2 (revisão do médico, RT 24/11/2026): escolhido, o consultório vira uma linha; as opções só voltam em "Trocar"
  if (atual && !trocando) {
    return (
      <div className="flex flex-wrap items-center gap-2.5 text-apoio">
        <MapPin className="size-[15px] text-acao" aria-hidden />
        <span className="font-medium text-grafite">{onde}Seu consultório: {atual.nome}</span>
        {consultorios.length > 1 && (
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => setTrocando(true)}>Trocar</Button>
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <MapPin className="size-[15px] text-acao" aria-hidden />
      <span className="text-apoio font-medium text-grafite">{onde}Seu consultório: {atual ? atual.nome : 'escolha'}</span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Consultório do plantão">
        {consultorios.map((s, i) => (
          <Chip key={s.id} ativo={s.id === atual?.id} desabilitado={consultorio.escolher.isPending}
            onClick={() => consultorio.escolher.mutate({ setor, sala: s.id }, { onSuccess: () => setTrocando(false) })}>
            {curtos[i] === s.nome ? s.nome : <><span aria-hidden>{curtos[i]}</span><span className="sr-only">{s.nome}</span></>}
          </Chip>
        ))}
      </div>
    </div>
  )
}

export function BarraConsultorio({ setores, consultorio }: { setores: string[]; consultorio: Consultorio }) {
  const salas = useQuery({
    queryKey: ['salas-das-portas', [...setores].sort().join(',')],
    enabled: setores.length > 0,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('salas').select('id, nome, tipo, setor_id, setor:setores(nome)')
        .in('setor_id', setores).eq('ativo', true).order('ordem')
      if (error) throw error
      return ((data ?? []) as unknown as (Omit<SalaDaPorta, 'setor_nome'> & { setor: { nome: string } | null })[])
        .map(({ setor, ...s }) => ({ ...s, setor_nome: setor?.nome ?? null }))
    },
  })
  if (salas.error) return <MensagemErro formato="linha" erro={salas.error} acao="ler os consultórios" className="mt-0" />
  if (setores.length === 0 || !salas.data) return null
  const portas = portasComConsultorio(setores, salas.data)
  return (
    <div className="flex flex-col gap-2">
      {portas.length === 0 ? (
        <div className="flex items-center gap-2.5 text-apoio text-tinta-sussurro">
          <MapPin className="size-[15px] text-acao" aria-hidden /> Nenhum consultório cadastrado na sua porta. O gestor cadastra em Setores.
        </div>
      ) : portas.map((p) => <LinhaDaPorta key={p.setor} porta={p} consultorio={consultorio} comSetor={portas.length > 1} />)}
      <MensagemErro formato="linha" erro={consultorio.escolher.error} acao="guardar o consultório" className="mt-0" />
    </div>
  )
}

import { MapPin } from 'lucide-react'

import { Chip } from '@/components/monitor/Pagina'
import { MensagemErro } from '@/components/ui/mensagem-erro'
import { useSalas } from '@/hooks/useChamadas'
import type { useConsultorioDoPlantao } from '@/hooks/useConsultorioDoPlantao'

// Barra do consultório acima das abas da fila do PS, no molde da barra da sala da
// triagem (revisão visual 3.4): escolhida uma vez no plantão, vale para todas as
// chamadas. Uma linha por porta em que o plantonista está de plantão agora.

type Consultorio = ReturnType<typeof useConsultorioDoPlantao>

function LinhaDaPorta({ setor, consultorio, varias }: { setor: string; consultorio: Consultorio; varias: boolean }) {
  const { data: salas } = useSalas(setor)
  const consultorios = (salas ?? []).filter((s) => s.tipo !== 'triagem')
  if (!salas) return null
  if (consultorios.length === 0) {
    return (
      <div className="flex items-center gap-2.5 text-apoio text-tinta-sussurro">
        <MapPin className="size-[15px] text-acao" aria-hidden /> Nenhum consultório cadastrado nesta porta. O gestor cadastra em Setores.
      </div>
    )
  }
  const atual = consultorios.find((s) => s.id === consultorio.salas[setor])
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <MapPin className="size-[15px] text-acao" aria-hidden />
      <span className="text-apoio font-medium text-grafite">
        {varias && 'Nesta porta · '}
        {atual ? `Seu consultório neste plantão: ${atual.nome}` : 'Escolha seu consultório para poder chamar no painel'}
      </span>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Consultório do plantão">
        {consultorios.map((s) => (
          <Chip key={s.id} ativo={s.id === atual?.id} desabilitado={consultorio.escolher.isPending}
            onClick={() => consultorio.escolher.mutate({ setor, sala: s.id })}>
            {s.nome}
          </Chip>
        ))}
      </div>
    </div>
  )
}

export function BarraConsultorio({ setores, consultorio }: { setores: string[]; consultorio: Consultorio }) {
  if (setores.length === 0) return null
  return (
    <div className="flex flex-col gap-2">
      {setores.map((s) => <LinhaDaPorta key={s} setor={s} consultorio={consultorio} varias={setores.length > 1} />)}
      <MensagemErro formato="linha" erro={consultorio.escolher.error} acao="guardar o consultório" className="mt-0" />
    </div>
  )
}

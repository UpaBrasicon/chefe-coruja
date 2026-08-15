import { Link, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { useAuth } from '@/contexts/AuthContext'
import { useUnidade } from '@/contexts/UnidadeContext'
import { ReceituarioMedico } from './atendimento/ReceituarioMedico'
import { AtestadoMedico } from './atendimento/AtestadoMedico'
import { Encaminhamento } from './atendimento/Encaminhamento'
import { PedidoExames } from './atendimento/PedidoExames'

const ferramentas = {
  'receituario-medico': { label: 'Receituário Médico', Component: ReceituarioMedico },
  'atestado-medico': { label: 'Atestado Médico', Component: AtestadoMedico },
  'encaminhamento': { label: 'Encaminhamento', Component: Encaminhamento },
  'pedido-exames': { label: 'Pedido de Exames', Component: PedidoExames },
} as const

export default function AtendimentoTool() {
  const { tool } = useParams()
  const { unidadeAtiva } = useUnidade()
  const { perfil } = useAuth()
  const unidadeId = unidadeAtiva?.unidade_id
  const perfilId = perfil?.id
  const def = tool ? ferramentas[tool as keyof typeof ferramentas] : undefined

  if (!def) {
    return <p className="text-sm text-destructive">Ferramenta não encontrada.</p>
  }

  const { label, Component } = def

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link to="/plantao" className="transition-colors hover:text-foreground">
          Central de Plantão
        </Link>
        <ChevronRight className="size-3.5" />
        <Link to="/plantao/atendimento-porta" className="transition-colors hover:text-foreground">
          Atendimento Porta
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <Component unidadeId={unidadeId} perfilId={perfilId} />
    </div>
  )
}

import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

import { ToolCard } from '@/components/plantonista/cards'

const ferramentas = [
  { slug: 'receituario-medico', label: 'Receituário Médico', description: 'Prescrição e receita digital.' },
  { slug: 'atestado-medico', label: 'Atestado Médico', description: 'Emissão de atestado.' },
  { slug: 'encaminhamento', label: 'Encaminhamento', description: 'Encaminhamento para especialidades.' },
  { slug: 'pedido-exames', label: 'Pedido de Exames', description: 'Solicitação de exames.' },
]

export default function AtendimentoPorta() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link to="/plantao" className="transition-colors hover:text-foreground">
            Central de Plantão
          </Link>
          <ChevronRight className="size-3.5" />
          <span className="font-medium text-foreground">Atendimento Porta</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Atendimento Porta</h1>
        <p className="text-sm text-muted-foreground">
          Documentos do atendimento de porta.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {ferramentas.map((f) => (
          <ToolCard
            key={f.slug}
            to={`/plantao/atendimento-porta/${f.slug}`}
            label={f.label}
            description={f.description}
          />
        ))}
      </div>
    </div>
  )
}

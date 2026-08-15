import { Activity, ClipboardList, DoorOpen } from 'lucide-react'

import { BannerCarousel } from '@/components/plantonista/BannerCarousel'
import { SectionCard } from '@/components/plantonista/cards'

export default function PlantaoHome() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      {/* Mesmo banner da Central do Plantonista */}
      <BannerCarousel />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Central de Plantão</h1>
            <p className="text-sm text-muted-foreground">
              Atendimento e internação — tema Plantão.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SectionCard
            to="/plantao/atendimento-porta"
            icon={DoorOpen}
            label="Atendimento Porta"
            description="Receituário médico, atestado, encaminhamento e pedido de exames."
            count={4}
          />
          <SectionCard
            to="/plantao/internacao"
            icon={ClipboardList}
            label="Internação"
            description="Identificar o paciente, anexar o atendimento e seguir com admissão, prescrição e documento de internação."
            count={1}
          />
        </div>
      </div>
    </div>
  )
}

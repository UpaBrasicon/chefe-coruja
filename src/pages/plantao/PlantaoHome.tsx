import { Activity } from 'lucide-react'

import { ehSecaoDireta, SECOES_PLANTAO } from '@/content/plantaoRegistry'
import { BannerCarousel } from '@/components/plantonista/BannerCarousel'
import { SectionCard } from '@/components/plantonista/cards'

/**
 * Central de Plantão — mesmo formato da Central do Plantonista: banner da unidade
 * e um grid de seções. Cada seção leva às ferramentas do turno.
 */
export default function PlantaoHome() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      {/* Quadro de imagens da unidade (gerenciado pelo gestor) */}
      <BannerCarousel />

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Activity className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Central de Plantão</h1>
            <p className="text-sm text-muted-foreground">
              Check-in, atendimento de porta, internação, observação e evolução clínica.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-foreground/80">Seções</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SECOES_PLANTAO.map((secao) => (
            <SectionCard
              key={secao.slug}
              to={`/plantao/${secao.slug}`}
              icon={secao.icon}
              label={secao.label}
              description={secao.description}
              count={secao.tools.length}
              // Seção de ferramenta única abre a ferramenta direto — contar "1
              // ferramenta" só criaria a expectativa de uma lista que não existe.
              rodape={ehSecaoDireta(secao) ? 'Abrir' : undefined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

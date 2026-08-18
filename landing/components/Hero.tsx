'use client'

import Image from 'next/image'

import { trackDemo } from '@/lib/analytics'
import { CtaButton } from '@/components/CtaButton'

/**
 * Hero acima da dobra — headline de benefício + CTA primário visível sem scroll.
 * Checklist item 1.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-white">
      <div className="container-site grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <span aria-hidden="true">✓</span> Conformidade CFM e LGPD nativa
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Gestão hospitalar simples, segura e em conformidade, feita por quem entende de UPA
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Prontuário eletrônico, gestão de leitos, prescrição e escala médica em uma única plataforma —
            pensada por um médico coordenador de UPA e pronta para hospitais, UPAs e clínicas.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CtaButton>Agendar demonstração</CtaButton>
            <CtaButton href="/funcionalidades" variant="outline">
              Conhecer funcionalidades
            </CtaButton>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Respondemos em até 4 horas úteis. Sem compromisso.
          </p>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          {/* TODO: imagem real do produto (dashboard) — 1200x800, formato webp */}
          <Image
            src="/hero-placeholder.svg"
            alt="Painel do Chefe Coruja mostrando a gestão de leitos e pacientes da unidade"
            width={1200}
            height={800}
            priority
            className="rounded-2xl border border-slate-200 shadow-xl"
          />
        </div>
      </div>
    </section>
  )
}

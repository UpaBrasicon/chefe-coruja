'use client'


import { trackDemo } from '@/lib/analytics'
import { CtaButton } from '@/components/CtaButton'

/**
 * Hero acima da dobra — headline de benefício + CTA primário visível sem scroll.
 * Checklist item 1.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 to-white">
      <div className="container-site py-16 md:py-24">
        <div className="min-w-0 max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            Segue as normas do CFM e a LGPD
          </p>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Prontuário e gestão de plantão feitos por um médico coordenador de UPA
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Prontuário eletrônico, gestão de leitos, prescrição e escala médica no mesmo sistema, para hospitais,
            UPAs e clínicas.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <CtaButton>Agendar demonstração</CtaButton>
            <CtaButton href="/funcionalidades" variant="outline">
              Conhecer funcionalidades
            </CtaButton>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Demonstração gratuita, sem compromisso.
          </p>
        </div>

        {/* A captura real do produto (porta, leitos, escala) entra no redesenho da landing,
            pedido 8 do RT, P2. O desenho de painel que havia aqui saiu: não carregava e não era o produto. */}
      </div>
    </section>
  )
}

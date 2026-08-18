import { Hero } from '@/components/Hero'
import { CaseStudy } from '@/components/CaseStudy'
import { Testimonials } from '@/components/Testimonials'
import { Team } from '@/components/Team'
import { FAQ } from '@/components/FAQ'
import { Location } from '@/components/Location'
import { CtaButton } from '@/components/CtaButton'

export default function HomePage() {
  return (
    <>
      <Hero />
      {/* Faixa de confiança — conformidade */}
      <section className="border-y border-slate-200 bg-slate-50">
        <div className="container-site grid gap-4 py-8 text-center sm:grid-cols-3">
          <div>
            <p className="text-2xl font-extrabold text-primary">CFM</p>
            <p className="text-sm text-slate-600">Diretrizes do CFM para prontuário eletrônico</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-primary">LGPD</p>
            <p className="text-sm text-slate-600">Dados de saúde tratados como sensíveis</p>
          </div>
          <div>
            <p className="text-2xl font-extrabold text-primary">3 níveis</p>
            <p className="text-sm text-slate-600">Admin, gestor e plantonista</p>
          </div>
        </div>
      </section>
      <CaseStudy />
      <Testimonials />
      <Team />
      <FAQ />
      <Location />
      <section className="container-site py-16 text-center">
        <h2 className="section-title">Pronto para organizar sua unidade?</h2>
        <p className="section-subtitle mx-auto max-w-2xl">
          Agende uma demonstração gratuita e veja como o Chefe Coruja se adapta à sua realidade.
        </p>
        <div className="mt-8">
          <CtaButton>Agendar demonstração</CtaButton>
        </div>
      </section>
    </>
  )
}

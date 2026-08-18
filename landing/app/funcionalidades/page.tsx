import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { CtaButton } from '@/components/CtaButton'

export const metadata: Metadata = {
  title: 'Funcionalidades',
  description:
    'Prontuário eletrônico, gestão de leitos, prescrição digital, escala médica e indicadores em uma única plataforma. Conheça as funcionalidades do Chefe Coruja.',
  alternates: { canonical: '/funcionalidades' },
  openGraph: {
    title: 'Funcionalidades | Chefe Coruja',
    description:
      'Prontuário, leitos, prescrição e escala em uma plataforma com conformidade CFM e LGPD.',
    images: [{ url: '/og-funcionalidades.svg', width: 1200, height: 630, alt: 'Funcionalidades do Chefe Coruja' }],
  },
}

const MODULOS = [
  {
    titulo: 'Prontuário Eletrônico',
    desc: 'Admissão, evolução, prescrição e alta com trilha de auditoria completa.',
  },
  {
    titulo: 'Gestão de Leitos',
    desc: 'Painel em tempo real por setor, com ocupação e alerta de superlotação.',
  },
  {
    titulo: 'Prescrição Digital',
    desc: 'Medicamentos padronizados, diluição e sugestões do gestor com revisão médica.',
  },
  {
    titulo: 'Escala Médica',
    desc: 'Escala fixa e mensal, trocas de plantão e justificativa de faltas.',
  },
  {
    titulo: 'Indicadores',
    desc: 'Taxa de ocupação, permanência média e giro de leito por setor.',
  },
  {
    titulo: 'Controle de Acesso',
    desc: 'Três níveis de acesso e liberação conforme a escala do dia.',
  },
]

export default function FuncionalidadesPage() {
  return (
    <div className="container-site">
      <Breadcrumbs items={[{ name: 'Funcionalidades', href: '/funcionalidades' }]} />
      <section className="py-8 md:py-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Funcionalidades</h1>
        <p className="section-subtitle">
          Tudo o que sua unidade precisa para operar com mais segurança e eficiência.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MODULOS.map((m) => (
            <div key={m.titulo} className="rounded-2xl border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-900">{m.titulo}</h2>
              <p className="mt-2 text-sm text-slate-600">{m.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <CtaButton>Agendar demonstração</CtaButton>
        </div>
      </section>
    </div>
  )
}

'use client'

import { useEffect } from 'react'

import { trackViewPricing } from '@/lib/analytics'
import { Breadcrumbs } from '@/components/Breadcrumbs'
import { CtaButton } from '@/components/CtaButton'

export default function PrecosPage() {
  // Evento GA4 view_pricing (item 20)
  useEffect(() => {
    trackViewPricing()
  }, [])

  const planos = [
    {
      nome: 'Clínica',
      preco: 'sob consulta',
      desc: 'Para clínicas que querem digitalizar a operação.',
      itens: ['Prontuário eletrônico', 'Agenda e atendimento', 'Suporte'],
    },
    {
      nome: 'UPA',
      preco: 'sob consulta',
      destaque: true,
      desc: 'Para UPAs com fluxo de urgência e emergência.',
      itens: ['Tudo do plano Clínica', 'Gestão de leitos e observação', 'Escala médica', 'Indicadores'],
    },
    {
      nome: 'Hospital',
      preco: 'sob consulta',
      desc: 'Para hospitais com múltiplos setores e leitos.',
      itens: ['Tudo do plano UPA', 'Multi-setor', 'Auditoria avançada', 'Suporte prioritário'],
    },
  ]

  return (
    <div className="container-site">
      <Breadcrumbs items={[{ name: 'Preços', href: '/precos' }]} />
      <section className="py-8 md:py-12">
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Planos e preços</h1>
        {/* TODO: definir tabela de preços real (mensal/anual, por unidade ou leito) */}
        <p className="section-subtitle">
          Valores personalizados conforme o porte e as necessidades da sua unidade. Fale com a gente.
        </p>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {planos.map((p) => (
            <div
              key={p.nome}
              className={`flex flex-col rounded-2xl border p-6 ${
                p.destaque ? 'border-primary bg-primary/5 shadow-lg' : 'border-slate-200'
              }`}
            >
              <h2 className="text-lg font-bold text-slate-900">{p.nome}</h2>
              <p className="mt-1 text-sm text-slate-600">{p.desc}</p>
              <p className="mt-4 text-2xl font-extrabold text-primary">{p.preco}</p>
              <ul className="mt-4 flex flex-1 flex-col gap-2">
                {p.itens.map((i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-slate-700">
                    <span aria-hidden="true" className="text-emerald-600">✓</span>
                    {i}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <CtaButton variant={p.destaque ? 'primary' : 'outline'} className="w-full">
                  {p.destaque ? 'Agendar demonstração' : 'Falar com vendas'}
                </CtaButton>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

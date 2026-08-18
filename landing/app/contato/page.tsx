import type { Metadata } from 'next'

import { Breadcrumbs } from '@/components/Breadcrumbs'
import { ContactForm } from '@/components/ContactForm'
import { BUSINESS } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Contato',
  description:
    'Fale com o Chefe Coruja. Agende uma demonstração gratuita para sua UPA, hospital ou clínica. Respondemos em até 4 horas úteis.',
  alternates: { canonical: '/contato' },
  openGraph: {
    title: 'Contato | Chefe Coruja',
    description: 'Agende uma demonstração gratuita do Chefe Coruja.',
    images: [{ url: '/og-contato.svg', width: 1200, height: 630, alt: 'Contato — Chefe Coruja' }],
  },
}

export default function ContatoPage() {
  return (
    <div className="container-site">
      <Breadcrumbs items={[{ name: 'Contato', href: '/contato' }]} />
      <section className="grid gap-10 py-8 md:grid-cols-2 md:py-12">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">Fale com a gente</h1>
          <p className="section-subtitle">
            Preencha o formulário e nossa equipe entra em contato. Respondemos em até 4 horas úteis.
          </p>
          <div className="mt-8 flex flex-col gap-4">
            <div className="rounded-2xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900">E-mail</h2>
              <a href={`mailto:${BUSINESS.email}`} className="mt-1 block text-sm text-primary hover:underline">
                {BUSINESS.email}
              </a>
            </div>
            <div className="rounded-2xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900">WhatsApp</h2>
              <a
                href={`https://wa.me/${BUSINESS.whatsapp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 block text-sm text-primary hover:underline"
              >
                {BUSINESS.telephone}
              </a>
            </div>
            <div className="rounded-2xl border border-slate-200 p-5">
              <h2 className="font-semibold text-slate-900">Sede</h2>
              <p className="mt-1 text-sm text-slate-600">
                {BUSINESS.address.city} · {BUSINESS.address.region}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8">
          <ContactForm />
        </div>
      </section>
    </div>
  )
}

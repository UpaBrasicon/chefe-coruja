'use client'

import { useEffect } from 'react'

import { track } from '@/lib/analytics'
import { CtaButton } from '@/components/CtaButton'

export default function ObrigadoPage() {
  // Evento de conversão (item 3) — reforço no servidor de conversão
  useEffect(() => {
    track('submit_form', { form_id: 'contato', status: 'success_page' })
  }, [])

  return (
    <div className="container-site">
      <section className="mx-auto max-w-2xl py-16 text-center md:py-24">
        <div
          className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-100 text-3xl"
          aria-hidden="true"
        >
          ✓
        </div>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-slate-900">Mensagem recebida!</h1>
        <p className="mt-4 text-lg text-slate-600">
          Obrigado pelo contato. Nossa equipe analisará sua solicitação e retornará em até{' '}
          <strong>4 horas úteis</strong>.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Enquanto isso, você pode:
          </h2>
          <ul className="flex flex-col gap-2 text-sm text-slate-600">
            <li>Conhecer as funcionalidades da plataforma.</li>
            <li>Conferir nossas perguntas frequentes.</li>
            <li>Chamar no WhatsApp para agilizar.</li>
          </ul>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <CtaButton href="/funcionalidades" variant="outline">
              Ver funcionalidades
            </CtaButton>
            <CtaButton href="/">Voltar ao início</CtaButton>
          </div>
        </div>
      </section>
    </div>
  )
}

'use client'

import Link from 'next/link'

import { trackDemo, trackWhatsapp } from '@/lib/analytics'
import { BUSINESS } from '@/lib/site'

/** CTA fixo (sticky bottom) — apenas mobile. Checklist item 2. */
export function StickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
      <div className="flex items-center gap-3">
        <a
          href={`https://wa.me/${BUSINESS.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackWhatsapp()}
          data-event="click_whatsapp"
          className="btn-whatsapp flex-1"
        >
          WhatsApp
        </a>
        <Link
          href="/contato"
          onClick={() => trackDemo('sticky-mobile')}
          data-event="click_demo"
          className="btn-primary flex-1"
        >
          Agendar demo
        </Link>
      </div>
    </div>
  )
}

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

import { trackDemo, trackWhatsapp } from '@/lib/analytics'
import { APP_URL, BUSINESS } from '@/lib/site'

const NAV = [
  { href: APP_URL, label: 'Início' },
  { href: `${APP_URL}/#registro`, label: 'Funcionalidades' },
  { href: '/precos', label: 'Preços' },
  { href: '/contato', label: 'Contato' },
]

export function Header() {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-site flex h-16 items-center justify-between gap-4">
        <Link href={APP_URL} className="flex items-center gap-2" aria-label="Chefe Coruja — página inicial">
          {/* a mesma marca do app (public/favicon.svg) */}
          <span
            className="flex size-9 items-center justify-center rounded-lg bg-primary text-white"
            aria-hidden="true"
          >
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M16 7h.01" />
            <path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
            <path d="m20 7 2 .5-2 .5" />
            <path d="M10 18v3" />
            <path d="M14 17.75V21" />
            <path d="M7 18a6 6 0 0 0 3.84-10.61" />
          </svg>
          </span>
          <span className="text-lg font-bold tracking-tight text-slate-900">Chefe Coruja</span>
        </Link>

        {/* Navegação desktop */}
        <nav className="hidden items-center gap-6 md:flex" aria-label="Navegação principal">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              data-utm="true"
              data-event="click_demo"
              className={`text-sm font-medium transition-colors hover:text-primary ${
                pathname === item.href ? 'text-primary' : 'text-slate-600'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {BUSINESS.whatsapp && (
            <a
              href={`https://wa.me/${BUSINESS.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              data-event="click_whatsapp"
              onClick={() => trackWhatsapp()}
              className="btn-whatsapp"
            >
              WhatsApp
            </a>
          )}
          <Link href="/contato" data-event="click_demo" onClick={() => trackDemo('header')} className="btn-primary">
            Agendar demonstração
          </Link>
        </div>

        {/* Botão menu mobile */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={open}
          className="rounded-md p-2 text-slate-700 md:hidden"
        >
          {open ? (
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Menu mobile */}
      {open && (
        <nav className="border-t border-slate-200 bg-white px-4 py-3 md:hidden" aria-label="Menu mobile">
          <div className="flex flex-col gap-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm font-medium ${
                  pathname === item.href ? 'bg-primary/10 text-primary' : 'text-slate-700'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <div className="mt-2 flex flex-col gap-2">
              {BUSINESS.whatsapp && (
                <a
                  href={`https://wa.me/${BUSINESS.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackWhatsapp()}
                  className="btn-whatsapp"
                >
                  WhatsApp
                </a>
              )}
              <Link href="/contato" onClick={() => trackDemo('menu-mobile')} className="btn-primary">
                Agendar demonstração
              </Link>
            </div>
          </div>
        </nav>
      )}
    </header>
  )
}

'use client'

import Link from 'next/link'

import { trackDemo } from '@/lib/analytics'

/**
 * Página 404 personalizada — busca/links úteis + CTA de volta à home.
 * Checklist item 18.
 */
export default function NotFound() {
  return (
    <div className="container-site">
      <section className="mx-auto max-w-xl py-16 text-center md:py-24">
        <p className="text-6xl font-extrabold text-primary" aria-hidden="true">
          404
        </p>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900">
          Página não encontrada
        </h1>
        <p className="mt-3 text-slate-600">
          O endereço que você acessou não existe ou foi movido. Tente navegar pelos links abaixo.
        </p>

        <nav className="mt-8" aria-label="Páginas úteis">
          <ul className="flex flex-wrap items-center justify-center gap-3">
            <li>
              <Link href="/" onClick={() => trackDemo('404-home')} className="btn-primary">
                Voltar ao início
              </Link>
            </li>
            <li>
              <Link href="/funcionalidades" onClick={() => trackDemo('404-funcionalidades')} className="btn-outline">
                Funcionalidades
              </Link>
            </li>
            <li>
              <Link href="/contato" onClick={() => trackDemo('404-contato')} className="btn-outline">
                Contato
              </Link>
            </li>
          </ul>
        </nav>
      </section>
    </div>
  )
}

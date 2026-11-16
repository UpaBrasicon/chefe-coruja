import Link from 'next/link'

import { APP_URL, BUSINESS } from '@/lib/site'

const LINKS = [
  { href: `${APP_URL}/#registro`, label: 'Funcionalidades' },
  { href: '/precos', label: 'Preços' },
  { href: '/contato', label: 'Contato' },
  { href: '/privacidade', label: 'Privacidade' },
]

export function Footer() {
  const ano = new Date().getFullYear()
  return (
    <footer className="border-t border-slate-200 bg-slate-50">
      <div className="container-site grid gap-8 py-12 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-white" aria-hidden="true">
              <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 7h.01" />
              <path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20" />
              <path d="m20 7 2 .5-2 .5" />
              <path d="M10 18v3" />
              <path d="M14 17.75V21" />
              <path d="M7 18a6 6 0 0 0 3.84-10.61" />
            </svg>
            </span>
            <span className="text-lg font-bold text-slate-900">Chefe Coruja</span>
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Gestão hospitalar para hospitais, UPAs e clínicas. Prontuário, leitos, prescrição e escala com
            conformidade CFM e LGPD.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Navegação</h3>
          <ul className="mt-3 flex flex-col gap-2">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-sm text-slate-600 hover:text-primary">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Contato</h3>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-slate-600">
            <li>
              <a href={`mailto:${BUSINESS.email}`} className="hover:text-primary">
                {BUSINESS.email}
              </a>
            </li>
            {BUSINESS.telephone && (
              <li>
                <a href={`tel:${BUSINESS.telephone.replace(/\D/g, '')}`} className="hover:text-primary">
                  {BUSINESS.telephone}
                </a>
              </li>
            )}
            <li>
              {BUSINESS.address.city} · {BUSINESS.address.region}
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Horário</h3>
          <p className="mt-3 text-sm text-slate-600">Segunda a sexta, 08h às 18h</p>
        </div>
      </div>

      <div className="border-t border-slate-200">
        <div className="container-site flex flex-col items-center justify-between gap-2 py-5 text-xs text-slate-500 sm:flex-row">
          <p>© {ano} Chefe Coruja. Todos os direitos reservados.</p>
          <p>
            Feito por médico coordenador de UPA em Aparecida de Goiânia · GO
          </p>
        </div>
      </div>
    </footer>
  )
}

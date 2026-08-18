import Link from 'next/link'

import { BUSINESS } from '@/lib/site'

const LINKS = [
  { href: '/funcionalidades', label: 'Funcionalidades' },
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
              🦉
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
            <li>
              <a href={`tel:${BUSINESS.telephone.replace(/\D/g, '')}`} className="hover:text-primary">
                {BUSINESS.telephone}
              </a>
            </li>
            <li>
              {BUSINESS.address.city} · {BUSINESS.address.region}
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900">Horário</h3>
          <p className="mt-3 text-sm text-slate-600">Segunda a sexta, 08h às 18h</p>
          <p className="mt-1 text-sm text-slate-600">Respondemos em até 4 horas úteis.</p>
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

// Seções do Plantão como abas (M1 da revisão do médico, RT 24/11/2026): "Meu
// turno" e as seções com cartão do registro, numa linha só, no topo do Plantão
// e de cada seção. Cada aba é um link: a rota de cada seção não muda.
import { NavLink } from 'react-router-dom'

import { SECOES_PLANTAO } from '@/content/plantaoRegistry'
import { cn } from '@/lib/utils'

const ABAS = [
  { to: '/plantao', rotulo: 'Meu turno', fim: true },
  ...SECOES_PLANTAO.filter((s) => !s.semCartao).map((s) => ({ to: `/plantao/${s.slug}`, rotulo: s.label, fim: false })),
]

export function AbasPlantao({ className }: { className?: string }) {
  return (
    <nav aria-label="Seções do plantão" className={cn('mb-[18px] flex gap-1 overflow-x-auto border-b border-fio-forte', className)}>
      {ABAS.map((a) => (
        <NavLink key={a.to} to={a.to} end={a.fim}
          className={({ isActive }) => cn(
            'relative -mb-px inline-flex shrink-0 items-center rounded-t-controle border-b-2 border-transparent px-3 pt-1.5 pb-2.5 text-apoio whitespace-nowrap text-tinta-sussurro transition-colors hover:text-acao',
            isActive && 'border-acao bg-alerta-marca font-semibold text-acao',
          )}>
          {a.rotulo}
        </NavLink>
      ))}
    </nav>
  )
}

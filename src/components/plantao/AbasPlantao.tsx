// Abas no topo do Plantão e da Internação do médico (RT, 24/11/2026): Plantão =
// Meu turno, Minha agenda e Prontuários; Internação = Internação, Observação e
// Passômetro. Cada aba é um link com rota própria (ver `rotasMedico.ts`).
import { Link, useLocation } from 'react-router-dom'

import { cn } from '@/lib/utils'

import { ABAS_INTERNACAO, ABAS_PLANTAO, type AbaArea } from './rotasMedico'

function AbasDaArea({ abas, rotulo, className }: { abas: AbaArea[]; rotulo: string; className?: string }) {
  const { pathname } = useLocation()
  return (
    <nav aria-label={rotulo} className={cn('mb-[18px] flex gap-1 overflow-x-auto border-b border-fio-forte', className)}>
      {abas.map((a) => {
        const ativa = a.casa(pathname)
        return (
          <Link key={a.to} to={a.to} aria-current={ativa ? 'page' : undefined}
            className={cn(
              'relative -mb-px inline-flex shrink-0 items-center rounded-t-controle border-b-2 border-transparent px-3 pt-1.5 pb-2.5 text-apoio whitespace-nowrap text-tinta-sussurro transition-colors hover:text-acao',
              ativa && 'border-acao bg-alerta-marca font-semibold text-acao',
            )}>
            {a.rotulo}
          </Link>
        )
      })}
    </nav>
  )
}

export function AbasPlantao({ className }: { className?: string }) {
  return <AbasDaArea abas={ABAS_PLANTAO} rotulo="Abas do plantão" className={className} />
}

export function AbasInternacao({ className }: { className?: string }) {
  return <AbasDaArea abas={ABAS_INTERNACAO} rotulo="Abas da internação" className={className} />
}

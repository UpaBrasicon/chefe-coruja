// Peças visuais comuns às telas da enfermagem (protótipo, P/index.html
// 1892–1926 e 8168–8203): o cartão com título, o botão "Cuidados" e a pílula
// dos aprazamentos atrasados.
import { ClipboardList } from 'lucide-react'
import type * as React from 'react'

import { cn } from '@/lib/utils'

import { PILULA } from './useEnfermagem'
import { Button } from '@/components/ui/button'

export function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-cartao border border-fio bg-superficie">
      <div className="border-b border-trilha px-5 py-3 text-apoio font-semibold text-tinta">{titulo}</div>
      {children}
    </section>
  )
}

export function BotaoCuidados({ onClick }: { onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick}>
      <ClipboardList className="size-3.5" aria-hidden /> Cuidados
    </Button>
  )
}

export function PilulaAtraso({ n }: { n: number }) {
  if (!n) return null
  return <span className={cn(PILULA, 'bg-alerta-critico text-critico')}>{n} {n === 1 ? 'aprazamento atrasado' : 'aprazamentos atrasados'}</span>
}

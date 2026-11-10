// Peças visuais comuns às telas da enfermagem (protótipo, P/index.html
// 1892–1926 e 8168–8203): o cartão com título, o botão "Cuidados" e a pílula
// dos aprazamentos atrasados.
import { ClipboardList } from 'lucide-react'
import type * as React from 'react'

import { selosDaContencao, type ContencaoAtiva } from '@/lib/contencao'
import { textoResumoValidade, type resumoValidade } from '@/lib/validadePrescricao'
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

/** Contenção mecânica ativa (lacuna 4): o selo mais urgente do servidor; sem selo, "Em contenção mecânica". */
export function PilulaContencao({ c }: { c: ContencaoAtiva | undefined }) {
  if (!c) return null
  const selo = selosDaContencao(c)[0]
  return (
    <span className={cn(PILULA, selo?.tom === 'critico' ? 'bg-alerta-critico text-critico' : 'bg-alerta-atencao text-atencao')}>
      {selo ? selo.texto : 'Em contenção mecânica'}
    </span>
  )
}

/** Prescrição vencida ou vencendo (lacuna 6, COFEN 689/2022): o item vencido não se administra. */
export function PilulaValidade({ r, agora }: { r: ReturnType<typeof resumoValidade> | undefined; agora: number }) {
  const t = r ? textoResumoValidade(r, agora) : null
  if (!t) return null
  return (
    <span title={t.titulo} className={cn(PILULA, t.tom === 'critico' ? 'bg-alerta-critico text-critico' : 'bg-alerta-atencao text-atencao')}>
      {t.texto}
    </span>
  )
}

export function PilulaAtraso({ n }: { n: number }) {
  if (!n) return null
  return <span className={cn(PILULA, 'bg-alerta-critico text-critico')}>{n} {n === 1 ? 'aprazamento atrasado' : 'aprazamentos atrasados'}</span>
}

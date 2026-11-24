// A ronda da checagem por horário (CK1, revisão do perfil Enfermeiro, RT
// 24/11/2026): Atrasadas · Agora (30 min antes e depois) · Próximas 2 h ·
// Mais tarde, e à parte o "se necessário" e o que falta aprazar. Os feitos do
// plantão ficam recolhidos (CK2). Na tela Checagem cruza pacientes; na gaveta
// Cuidados é a mesma lista, só do paciente (CK0).
import { ChevronDown } from 'lucide-react'
import type * as React from 'react'

import { agruparRonda } from '@/lib/rondaChecagem'
import { cn } from '@/lib/utils'

import type { ContextoItens, LinhaChecagem } from './dados'
import { ItemChecagem } from './ItemChecagem'

export function ListaRonda({ linhas, ctx, souEnfermeiro, agora, aoMudar, aoErro, paciente, vazio }: {
  linhas: LinhaChecagem[]; ctx: ContextoItens; souEnfermeiro: boolean; agora: number
  aoMudar: () => void; aoErro: (m: string | null) => void
  /** O paciente de cada item, na ronda que cruza pacientes. */
  paciente?: (l: LinhaChecagem) => React.ReactNode
  vazio?: React.ReactNode
}) {
  const grupos = agruparRonda(linhas, agora)
  const item = (l: LinhaChecagem) => (
    <ItemChecagem key={l.item_id} l={l} ctx={ctx} souEnfermeiro={souEnfermeiro} agora={agora} aoMudar={aoMudar} aoErro={aoErro}
      paciente={paciente?.(l)} />
  )
  if (linhas.length === 0) return <>{vazio ?? null}</>
  return (
    <div className="flex flex-col gap-4">
      {grupos.filter((g) => g.itens.length > 0).map((g) => g.id === 'feitos' ? (
        <details key={g.id} className="group flex flex-col gap-2">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 text-apoio text-tinta-sussurro hover:text-acao">
            {g.rotulo} ({g.itens.length})
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
          </summary>
          <div className="mt-2 flex flex-col gap-2">{g.itens.map(item)}</div>
        </details>
      ) : (
        <section key={g.id} aria-label={g.rotulo} className="flex flex-col gap-2">
          <h3 className={cn('flex items-baseline gap-2 text-apoio font-semibold', g.id === 'atrasadas' ? 'text-critico' : 'text-tinta')}>
            {g.rotulo} <span className="font-normal tabular-nums text-tinta-sussurro">{g.itens.length}</span>
          </h3>
          {g.itens.map(item)}
        </section>
      ))}
    </div>
  )
}

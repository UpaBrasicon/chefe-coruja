import * as React from 'react'

import { cn } from '@/lib/utils'

// Peças das telas do administrador no desenho do protótipo (P/index.html
// 9391–9408 e 9989–10004): a faixa de métricas num cartão só e as abas
// sublinhadas no topo de uma lista.

export const cartao = 'overflow-hidden rounded-cartao border border-fio bg-superficie shadow-repouso'

export type Metrica = { rotulo: string; valor: React.ReactNode; nota?: React.ReactNode; tom?: 'atencao' | 'critico' }

/** Faixa de métricas: 4 colunas num cartão, divisória entre elas; quebra no estreito. */
export function Metricas({ itens, className }: { itens: Metrica[]; className?: string }) {
  return (
    <div className={cn(cartao, 'mb-3.5 flex flex-wrap', className)}>
      {itens.map((m, i) => (
        <div key={m.rotulo} className={cn('flex min-w-[150px] flex-1 flex-col gap-0.5 px-5 py-[15px]', i > 0 && 'border-l border-trilha')}>
          <span className={cn('text-rotulo font-semibold tracking-[0.06em] uppercase', m.tom === 'atencao' ? 'text-atencao' : m.tom === 'critico' ? 'text-critico' : 'text-tinta-sussurro')}>
            {m.rotulo}
          </span>
          <span className={cn('text-[26px] leading-[1.15] font-semibold tracking-[-0.02em] tabular-nums',
            m.tom === 'atencao' ? 'text-atencao' : m.tom === 'critico' ? 'text-critico' : 'text-tinta')}>
            {m.valor}
          </span>
          {m.nota && <span className="text-apoio text-pretty text-tinta-sussurro">{m.nota}</span>}
        </div>
      ))}
    </div>
  )
}

/** Abas sublinhadas no topo do cartão da lista. */
export function Abas<V extends string>({ opcoes, valor, onChange, rotulo }: {
  opcoes: { valor: V; rotulo: string; contagem?: number }[]; valor: V; onChange: (v: V) => void; rotulo: string
}) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex overflow-x-auto overflow-y-hidden border-b border-fio">
      {opcoes.map((o) => {
        const ativa = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            role="tab"
            aria-selected={ativa}
            onClick={() => onChange(o.valor)}
            className={cn(
              '-mb-px border-b-2 px-[15px] py-[11px] text-apoio whitespace-nowrap transition-colors',
              ativa ? 'border-marca font-semibold text-acao' : 'border-transparent text-tinta-sussurro hover:text-acao',
            )}
          >
            {o.rotulo}
            {o.contagem !== undefined && <span className="ml-1.5 tabular-nums opacity-80">{o.contagem}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Barra fina de proporção (ocupação, uso). */
export function Barra({ pct, tom = 'conforme', className }: { pct: number | null; tom?: 'conforme' | 'atencao' | 'critico'; className?: string }) {
  const p = pct === null ? 0 : Math.max(0, Math.min(100, pct))
  return (
    <div className={cn('relative h-1.5 overflow-hidden rounded-capsula bg-trilha', className)} aria-hidden>
      <div
        className={cn('absolute inset-y-0 left-0 rounded-capsula', tom === 'critico' ? 'bg-critico' : tom === 'atencao' ? 'bg-atencao' : 'bg-conforme')}
        style={{ width: `${p}%` }}
      />
    </div>
  )
}

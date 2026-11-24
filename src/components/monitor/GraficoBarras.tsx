// Gráfico de barras simples (Recharts, a biblioteca que o projeto já usa na
// evolução clínica). Revisão do gestor e do admin (RT, 24/11/2026): um gráfico
// principal por tela, e o vazio diz por que está vazio e o que fazer.
import type { ReactNode } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { VazioLinha } from '@/components/monitor/Pagina'
import { numeroAte } from '@/lib/formato'
import { cn } from '@/lib/utils'

export type SerieBarra = { chave: string; nome: string; cor?: string }
export type PontoBarra = { rotulo: string } & Record<string, string | number | null>

// Cores das séries pelos tokens (guia 5.5): funcionam nos dois temas.
const CORES = ['var(--color-acao)', 'var(--color-suprimento)', 'var(--color-observacao)', 'var(--color-pediatria)', 'var(--color-atencao)', 'var(--color-conforme)']

export function GraficoBarras({ dados, series, empilhado = false, vazio, rotulo, className }: {
  dados: PontoBarra[]
  series: SerieBarra[]
  empilhado?: boolean
  /** O que dizer quando não há dado: por que está vazio e o que fazer. */
  vazio: ReactNode
  /** Descrição para leitor de tela. */
  rotulo: string
  className?: string
}) {
  const temDado = dados.some((d) => series.some((s) => Number(d[s.chave] ?? 0) > 0))
  if (!temDado) return <VazioLinha className={className}>{vazio}</VazioLinha>
  return (
    <div role="img" aria-label={rotulo} className={cn('h-56 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={dados} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--color-trilha)" />
          <XAxis dataKey="rotulo" tick={{ fontSize: 11, fill: 'var(--color-tinta-sussurro)' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--color-tinta-sussurro)' }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            cursor={{ fill: 'var(--color-trilha)' }}
            contentStyle={{ fontSize: 12, borderRadius: 8, background: 'var(--color-superficie)', border: '1px solid var(--color-fio)' }}
            formatter={(v, nome) => [numeroAte(Number(v ?? 0), 1), String(nome)]}
          />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />}
          {series.map((s, i) => (
            <Bar key={s.chave} dataKey={s.chave} name={s.nome} fill={s.cor ?? CORES[i % CORES.length]}
              stackId={empilhado ? 'pilha' : undefined} radius={empilhado && i < series.length - 1 ? 0 : [3, 3, 0, 0]} maxBarSize={36} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

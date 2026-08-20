// ─────────────────────────────────────────────────────────────────────────────
// GraficoEvolucao — gráfico de evolução clínica (Recharts)
//
// Múltiplos conceitos sobrepostos, faixa de referência sombreada e marcação
// de valores críticos, com eixo temporal alinhado aos dias de internação.
// ─────────────────────────────────────────────────────────────────────────────
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import type { SerieObservacao } from '@/lib/observacao'
import { cn } from '@/lib/utils'

type Props = {
  series: SerieObservacao[]
  /** Data de admissão p/ eixo em dias de internação (ex.: "D+1"). */
  dataAdmissao?: string
  className?: string
}

type DadoGrafico = {
  rotulo: string
  [conceito: string]: string | number | null
}

const CORES = ['#0d9488', '#2563eb', '#d97706', '#7c3aed', '#dc2626', '#059669']

function diaInternacao(aferidoEm: string, dataAdmissao?: string): string {
  if (!dataAdmissao) return new Date(aferidoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
  const inicio = new Date(dataAdmissao).getTime()
  const d = Math.floor((new Date(aferidoEm).getTime() - inicio) / 86_400_000) + 1
  return d >= 1 ? `D+${d}` : 'Adm'
}

export function GraficoEvolucao({ series, dataAdmissao, className }: Props) {
  if (series.length === 0) {
    return <p className="text-sm text-muted-foreground">Sem observações para exibir.</p>
  }

  // mescla pontos por rótulo de tempo (dia de internação ou data/hora)
  const mapa = new Map<string, DadoGrafico>()
  for (const s of series) {
    for (const p of s.pontos) {
      const rotulo = diaInternacao(p.aferido_em, dataAdmissao)
      const existente = mapa.get(rotulo) ?? { rotulo }
      if (p.valor_num != null) existente[s.conceito.nome] = p.valor_num
      mapa.set(rotulo, existente)
    }
  }
  const dados = [...mapa.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt-BR', { numeric: true }))

  // faixa de referência: usa a 1ª série que tiver ref_min/ref_max
  const ref = series.find((s) => s.conceito.ref_min != null || s.conceito.ref_max != null)?.conceito
  const yMin = ref?.ref_min != null ? ref.ref_min - Math.abs(ref.ref_min) * 0.3 : undefined
  const yMax = ref?.ref_max != null ? ref.ref_max + Math.abs(ref.ref_max) * 0.3 : undefined

  return (
    <div className={cn('h-64 w-full', className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={dados} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            dataKey="rotulo"
            tick={{ fontSize: 11 }}
            tickLine={false}
            label={{ value: 'Dia de internação', position: 'insideBottom', offset: -2, fontSize: 11 }}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            width={44}
            domain={[yMin ?? 'auto', yMax ?? 'auto']}
            label={{ value: ref?.unidade_padrao ?? '', angle: -90, position: 'insideLeft', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(v, nome) => [`${String(v ?? '')}`, String(nome)]}
          />
          {ref && (ref.ref_min != null || ref.ref_max != null) && (
            <ReferenceArea
              y1={ref.ref_min ?? undefined}
              y2={ref.ref_max ?? undefined}
              fill="rgba(13,148,136,0.08)"
              strokeDasharray="4 4"
              label={{ value: 'Referência', position: 'insideTopRight', fontSize: 10, fill: '#0d9488' }}
            />
          )}
          {series.map((s, i) => (
            <Line
              key={s.conceito.id}
              type="monotone"
              dataKey={s.conceito.nome}
              stroke={CORES[i % CORES.length]}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          ))}
          {/* marcação de valores críticos */}
          {series.flatMap((s) =>
            s.pontos
              .filter((p) => p.flag === 'CRIT' && p.valor_num != null)
              .map((p) => (
                <ReferenceDot
                  key={p.observacao_id}
                  x={diaInternacao(p.aferido_em, dataAdmissao)}
                  y={p.valor_num as number}
                  r={5}
                  fill="#dc2626"
                  stroke="#fff"
                  strokeWidth={1.5}
                />
              ))
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

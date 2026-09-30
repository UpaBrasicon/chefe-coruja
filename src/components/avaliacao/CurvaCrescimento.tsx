// ─────────────────────────────────────────────────────────────────────────────
// Gráfico da curva de crescimento (Recharts). Linhas de escore-z −3, −2, 0, +2
// e +3 pelo LMS da tabela da OMS, mês a mês; pontos pretos do paciente, com o
// escore-z no tooltip; "Linha" liga os pontos (tracejado, como no protótipo).
// Cores do protótipo: ±3 grafite, ±2 vermelho, 0 verde.
// ─────────────────────────────────────────────────────────────────────────────
import { CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { LINHAS_Z, defIndicador, linhaZ, type Indicador, type Intervalo, type Sexo } from '@/clinico/crescimento/curvas'

export type PontoPaciente = { meses: number; valor: number; texto: string }

const COR_Z: Record<number, string> = { [-3]: '#111827', [-2]: '#B91C1C', 0: '#15803D', 2: '#B91C1C', 3: '#111827' }
const rotuloZ = (z: number) => (z > 0 ? `+${z}` : z < 0 ? `−${-z}` : '0')
const chaveZ = (z: number) => `z${z < 0 ? 'm' : 'p'}${Math.abs(z)}`

type Linha = { meses: number; pac?: number; texto?: string; [k: string]: number | string | undefined }

export function CurvaCrescimento({ indicador, sexo, intervalo, pontos, ligar }: {
  indicador: Indicador; sexo: Sexo; intervalo: Intervalo; pontos: PontoPaciente[]; ligar: boolean
}) {
  const def = defIndicador(indicador)
  const faixa = def.intervalos[intervalo]
  if (!faixa) return null
  const [x0, x1] = faixa

  const mapa = new Map<number, Linha>()
  for (const z of LINHAS_Z) {
    for (const p of linhaZ(indicador, sexo, intervalo, z)) {
      const l = mapa.get(p.meses) ?? { meses: p.meses }
      l[chaveZ(z)] = Number(p.valor.toFixed(2))
      mapa.set(p.meses, l)
    }
  }
  for (const p of pontos) {
    const l = mapa.get(p.meses) ?? { meses: p.meses }
    l.pac = p.valor
    l.texto = p.texto
    mapa.set(p.meses, l)
  }
  const dados = [...mapa.values()].sort((a, b) => a.meses - b.meses)

  // índice do último ponto de cada linha (onde vai o rótulo)
  const ultimoDe = new Map<number, number>()
  dados.forEach((d, i) => { for (const z of LINHAS_Z) if (typeof d[chaveZ(z)] === 'number') ultimoDe.set(z, i) })

  const passo = x1 - x0 > 80 ? 10 : 5
  const valores = dados.flatMap((d) => [d[chaveZ(-3)], d[chaveZ(3)], d.pac]).filter((v): v is number => typeof v === 'number')
  const ymin = intervalo === '0-5' ? 0 : Math.max(0, Math.floor(Math.min(...valores) / passo) * passo)
  const ymax = Math.ceil(Math.max(...valores) / passo) * passo
  const ticksX = intervalo === '0-5' ? [0, 12, 24, 36, 48, 60] : Array.from({ length: Math.floor((x1 - 60) / 12) }, (_, i) => 72 + i * 12).filter((m) => m <= x1)

  return (
    <div className="h-[320px] w-full max-w-[720px]" role="img"
      aria-label={`Curva ${def.rotulo}, ${sexo === 'M' ? 'meninos' : 'meninas'}, ${pontos.length} aferições do paciente`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={dados} margin={{ top: 8, right: 34, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="#F1F5F9" vertical={false} />
          <XAxis dataKey="meses" type="number" domain={[x0, x1]} ticks={ticksX} tickLine={false}
            tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(m: number) => (m === 0 ? 'Nasc.' : `${m / 12} a`)} />
          <YAxis domain={[ymin, ymax]} tickLine={false} width={44} tick={{ fontSize: 11, fill: '#64748B' }}
            label={{ value: def.unidade, angle: -90, position: 'insideLeft', fontSize: 11, fill: '#64748B' }} />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#E2E8F0' }}
            labelFormatter={(m) => { const n = Number(m); const a = Math.floor(n / 12); const r = Math.floor(n % 12); return `${a} a ${r} m` }}
            formatter={(v, nome, item) => {
              const p = item?.payload as Linha | undefined
              if (nome === 'Paciente' && p?.texto) return [p.texto, 'Paciente']
              return [`${String(v)} ${def.unidade}`, String(nome)]
            }}
          />
          {LINHAS_Z.map((z) => (
            <Line key={z} dataKey={chaveZ(z)} name={`escore-z ${rotuloZ(z)}`} stroke={COR_Z[z]} strokeWidth={1.4}
              dot={false} activeDot={false} connectNulls isAnimationActive={false}
              label={(props: { index?: number; x?: number | string; y?: number | string }) => {
                // rótulo da linha só no último ponto (à direita, como no protótipo)
                if (props.index !== ultimoDe.get(z)) return <g />
                return <text x={Number(props.x) + 4} y={Number(props.y) + 3} fontSize={10} fill={COR_Z[z]}>{rotuloZ(z)}</text>
              }} />
          ))}
          <Line dataKey="pac" name="Paciente" stroke={ligar ? '#111827' : 'transparent'} strokeWidth={1.2} strokeDasharray="3 3"
            connectNulls isAnimationActive={false}
            dot={{ r: 4, fill: '#111827', stroke: '#FFFFFF', strokeWidth: 1.5 }} activeDot={{ r: 5, fill: '#111827' }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

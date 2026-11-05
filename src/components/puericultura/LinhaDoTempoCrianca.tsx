// Linha do tempo da criança (puericultura; opção B, a mesma do pré-natal):
// do nascimento aos 2 anos, com os primeiros 30 dias, o 1º e o 2º ano em
// faixas, as consultas de puericultura como marcas e "hoje" em vermelho.
import { PRIMEIRA_ATE_DIAS, diasEntre, doisAnos, marcasDa, posicao, type RegistrosPuericultura } from '@/domain/puericultura'
import { cn } from '@/lib/utils'

/** A régua de meses, sobre as linhas do painel. */
export function EscalaMeses({ className }: { className?: string }) {
  const marcos: [number, string][] = [[0, 'nascimento'], [25, '6 m'], [50, '1 ano'], [75, '18 m'], [100, '2 anos']]
  return (
    <div aria-hidden className={cn('relative h-4 text-rotulo text-tinta-sussurro', className)}>
      {marcos.map(([p, r]) => (
        <span key={r} className="absolute whitespace-nowrap" style={{ left: `${p}%`, transform: p === 0 ? undefined : p === 100 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{r}</span>
      ))}
    </div>
  )
}

export function LinhaDoTempoCrianca({ c, hoje, className }: { c: RegistrosPuericultura & { data_nascimento: string }; hoje: string; className?: string }) {
  const nasc = c.data_nascimento
  const total = diasEntre(nasc, doisAnos(nasc))
  const pct = (d: number) => `${(d / total) * 100}%`
  const umAno = Math.round(total / 2)
  const agora = posicao(nasc, hoje)
  const marcas = marcasDa(c)
  return (
    <div role="img" aria-label={`Linha do tempo da criança: ${marcas.map((m) => m.titulo).join('; ') || 'nenhuma consulta de puericultura registrada'}`}
      className={cn('relative h-6 overflow-hidden rounded-controle border border-fio', className)}>
      <div className="absolute inset-y-0 left-0 bg-alerta-marca" style={{ width: pct(PRIMEIRA_ATE_DIAS + 1) }} />
      <div className="absolute inset-y-0 bg-campo" style={{ left: pct(PRIMEIRA_ATE_DIAS + 1), width: pct(umAno - PRIMEIRA_ATE_DIAS - 1) }} />
      <div className="absolute inset-y-0 right-0 bg-alerta-marca/40" style={{ left: pct(umAno) }} />
      <div className="absolute inset-y-0 left-0 bg-acao/15" style={{ width: `${agora}%` }} />
      {marcas.map((m, i) => (
        <span key={i} title={m.titulo}
          className={cn('absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-capsula',
            m.tipo === 'consulta' ? 'bg-acao' : 'z-10 border-2 border-critico bg-superficie')}
          style={{ left: `${m.pos}%` }} />
      ))}
      <div title="Hoje" className="absolute -inset-y-px w-0.5 bg-critico" style={{ left: `${agora}%` }} />
    </div>
  )
}

export function LegendaLinhaDoTempoCrianca() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-rotulo text-tinta-sussurro">
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-capsula bg-acao" /> consulta de puericultura</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-capsula border-2 border-critico" /> 1ª consulta depois do 30º dia</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-critico" /> hoje</span>
      <span>faixas: primeiros 30 dias, 1º e 2º ano</span>
    </div>
  )
}

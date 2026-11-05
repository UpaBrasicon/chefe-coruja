// Linha do tempo da gestação (opção B do RT em 05/11/2026, ref. Wrike Gantt):
// 42 semanas mais os 42 dias do puerpério, os trimestres em faixas, as
// consultas e os testes como marcas e "hoje" em vermelho. A régua dos dias
// fica em src/domain/preNatal.ts.
import { ESCALA_DIAS, JANELA, marcasDa, posicao, type Gestacao } from '@/domain/preNatal'
import { cn } from '@/lib/utils'

const pct = (dias: number) => `${(dias / ESCALA_DIAS) * 100}%`
// fronteiras das faixas: 1º trimestre até 13s6d, 3º a partir de 28s0d, fim com 42 semanas
const FAIXAS = [
  { de: 0, ate: JANELA.t1Ate + 1, classe: 'bg-alerta-marca' },
  { de: JANELA.t1Ate + 1, ate: JANELA.t3Desde, classe: 'bg-campo' },
  { de: JANELA.t3Desde, ate: JANELA.fim, classe: 'bg-alerta-marca' },
  { de: JANELA.fim, ate: ESCALA_DIAS, classe: 'bg-alerta-observacao' },
]

/** A régua de semanas, sobre as linhas do painel. */
export function EscalaSemanas({ className }: { className?: string }) {
  const marcos: [number, string][] = [[0, '0'], [84, '12 s'], [98, '14'], [196, '28'], [280, '40'], [ESCALA_DIAS, '+42 d']]
  return (
    <div aria-hidden className={cn('relative h-4 text-rotulo text-tinta-sussurro', className)}>
      {marcos.map(([d, r]) => (
        <span key={r} className="absolute whitespace-nowrap" style={{ left: pct(d), transform: d === 0 ? undefined : d === ESCALA_DIAS ? 'translateX(-100%)' : 'translateX(-50%)' }}>{r}</span>
      ))}
    </div>
  )
}

export function LinhaDoTempo({ g, hoje, className }: { g: Gestacao; hoje: string; className?: string }) {
  if (!g.dum) return null
  const agora = posicao(g.dum, hoje)
  const marcas = marcasDa(g)
  const fim = g.desfecho_em ? posicao(g.dum, g.desfecho_em) : null
  return (
    <div role="img" aria-label={`Linha do tempo da gestação: ${marcas.map((m) => m.titulo).join('; ') || 'nenhuma consulta nem teste registrado'}`}
      className={cn('relative h-6 overflow-hidden rounded-controle border border-fio', className)}>
      {FAIXAS.map((f) => <div key={f.de} className={cn('absolute inset-y-0', f.classe)} style={{ left: pct(f.de), width: pct(f.ate - f.de) }} />)}
      <div className="absolute inset-y-0 left-0 bg-acao/15" style={{ width: `${agora}%` }} />
      {fim !== null && <div title="Parto" className="absolute inset-y-0 w-px bg-tinta-apoio" style={{ left: `${fim}%` }} />}
      {marcas.map((m, i) => (
        <span key={i} title={m.titulo}
          className={cn('absolute top-1/2 -translate-x-1/2 -translate-y-1/2',
            m.tipo === 'consulta' && 'size-2.5 rounded-capsula bg-acao',
            m.tipo === 'teste' && 'size-2.5 rotate-45 bg-marca',
            // a 1ª consulta tardia fica por cima de um teste no mesmo dia
            m.tipo === 'perdido' && 'z-10 size-2.5 rounded-capsula border-2 border-critico bg-superficie')}
          style={{ left: `${m.pos}%` }} />
      ))}
      <div title="Hoje" className="absolute -inset-y-px w-0.5 bg-critico" style={{ left: `${agora}%` }} />
    </div>
  )
}

/** A legenda das marcas. */
export function LegendaLinhaDoTempo() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-rotulo text-tinta-sussurro">
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-capsula bg-acao" /> consulta</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rotate-45 bg-marca" /> teste</span>
      <span className="flex items-center gap-1.5"><span className="size-2.5 rounded-capsula border-2 border-critico" /> 1ª consulta depois de 12 semanas</span>
      <span className="flex items-center gap-1.5"><span className="h-3 w-0.5 bg-critico" /> hoje</span>
      <span>faixas: 1º, 2º e 3º trimestre e puerpério</span>
    </div>
  )
}

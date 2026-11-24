// Faixa de fases da implantação (revisão do admin e do gestor, RT 24/11/2026,
// Implantação M1): as quatro fases numa linha no topo, com o progresso dos
// obrigatórios de cada uma, a fase em que a unidade está pelo calendário e a
// contagem até a virada. Cada fase leva ao cartão dela, mais abaixo.
import { CheckCircle2 } from 'lucide-react'

import { contagemVirada, faseDoDia, FASES, resumoFase, type Item } from '@/lib/implantacao'
import { cn } from '@/lib/utils'

export function FaixaFasesImplantacao({ itens, d0, hoje, encerrada }: { itens: Item[]; d0: string; hoje: string; encerrada: boolean }) {
  const atual = faseDoDia(d0, hoje, encerrada)
  const total = FASES.reduce((a, f) => a + resumoFase(itens, f.fase).obrigatorios, 0)
  const feitos = FASES.reduce((a, f) => a + resumoFase(itens, f.fase).feitos, 0)
  return (
    <section aria-label="Fases da implantação" className="flex flex-col gap-3 rounded-cartao border border-fio bg-superficie px-4 py-3 shadow-repouso">
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-apoio">
        <span className="font-semibold text-tinta">{encerrada ? 'Implantação encerrada' : contagemVirada(d0, hoje)}</span>
        <span className="text-tinta-sussurro">{feitos} de {total} obrigatórios feitos</span>
      </div>
      <ol className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {FASES.map((f, i) => {
          const r = resumoFase(itens, f.fase)
          const completa = r.obrigatorios > 0 && r.feitos === r.obrigatorios
          const eAtual = f.fase === atual
          const pct = r.obrigatorios ? Math.round((r.feitos / r.obrigatorios) * 100) : 0
          return (
            <li key={f.fase}>
              <a href={`#fase-${f.fase}`} aria-current={eAtual ? 'step' : undefined}
                className={cn('flex flex-col gap-1 rounded-controle border px-3 py-2 transition-colors hover:border-acao',
                  eAtual ? 'border-acao bg-alerta-marca' : 'border-fio')}>
                <span className="flex items-center gap-1.5 text-rotulo text-tinta-sussurro">
                  {completa ? <CheckCircle2 className="size-3.5 text-conforme" aria-hidden /> : <span className="tabular-nums">{i + 1}</span>}
                  {f.janela}{eAtual && <span className="font-medium text-acao">· agora</span>}
                </span>
                <span className={cn('text-controle font-medium', completa ? 'text-tinta-apoio' : 'text-tinta')}>{f.rotulo}</span>
                <span className="h-1.5 overflow-hidden rounded-capsula bg-trilha" aria-hidden>
                  <span className={cn('block h-full rounded-capsula', completa ? 'bg-conforme' : 'bg-acao')} style={{ width: `${pct}%` }} />
                </span>
                <span className="text-rotulo text-tinta-sussurro">{r.feitos} de {r.obrigatorios} obrigatórios</span>
              </a>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

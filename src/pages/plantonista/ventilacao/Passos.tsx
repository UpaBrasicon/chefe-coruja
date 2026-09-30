import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Barra de passos das ferramentas "em cinco passos" (protótipo: vmPassos e
// vniPassos): número grande, rótulo curto, passo atual cheio, passos já
// vistos com contorno da ação. Qualquer passo pode ser aberto direto.

export function BarraPassos({ passos, atual, ir, nota }: { passos: readonly string[]; atual: number; ir: (n: number) => void; nota?: ReactNode }) {
  return (
    <nav aria-label="Passos" className="flex flex-col gap-2.5 rounded-container border border-fio bg-card px-4 py-3.5">
      <ol className="flex flex-wrap gap-2">
        {passos.map((rotulo, i) => {
          const n = i + 1
          return (
            <li key={rotulo} className="min-w-24 flex-1">
              <button
                type="button"
                aria-current={n === atual ? 'step' : undefined}
                onClick={() => ir(n)}
                className={cn(
                  'flex w-full flex-col items-center gap-0.5 rounded-controle border px-1.5 py-2.5 transition-colors',
                  n === atual ? 'border-acao bg-acao text-white' : n < atual ? 'border-acao bg-card text-acao' : 'border-fio bg-card text-tinta-sussurro hover:bg-trilha/50',
                )}
              >
                <span className="text-[19px] leading-none font-semibold tabular-nums">{n}</span>
                <span className="text-rotulo font-medium">{rotulo}</span>
              </button>
            </li>
          )
        })}
      </ol>
      {nota && <p className="text-apoio text-tinta-sussurro">{nota}</p>}
    </nav>
  )
}

export function NavPassos({ atual, total, ir, proximo }: { atual: number; total: number; ir: (n: number) => void; proximo?: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <Button type="button" variant="outline" disabled={atual <= 1} onClick={() => ir(atual - 1)}>
        <ChevronLeft /> Voltar
      </Button>
      {atual < total && (
        <Button type="button" onClick={() => ir(atual + 1)}>
          {proximo ?? 'Próximo passo'} <ChevronRight />
        </Button>
      )}
    </div>
  )
}

/** Cartão de um passo, com título "n · pergunta". */
export function CartaoPasso({ n, titulo, children }: { n: number; titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-container border border-fio bg-card p-5 text-sm">
      <h2 className="text-secao font-semibold tracking-[-0.01em] text-tinta">{n} · {titulo}</h2>
      {children}
    </section>
  )
}

export type EstadoLinha = 'ok' | 'fora' | 'sem-faixa' | 'vazio'

const COR: Record<EstadoLinha, string> = {
  ok: 'text-conforme',
  fora: 'text-critico',
  'sem-faixa': 'text-tinta-apoio',
  vazio: 'text-tinta-sussurro',
}
const ROTULO: Record<EstadoLinha, string> = { ok: 'dentro do livro', fora: 'fora do livro', 'sem-faixa': 'sem faixa no livro', vazio: 'não informado' }

/** Tabela de conferência: parâmetro, valor, o que o livro traz e a leitura. */
export function TabelaConferencia({ linhas }: { linhas: { parametro: string; valor: string; livro: string; estado: EstadoLinha; nota?: string; pagina: string }[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left align-top text-sm">
        <thead className="text-tinta-sussurro">
          <tr><th className="pr-3 pb-2 font-medium">Parâmetro</th><th className="pr-3 pb-2 font-medium">Valor</th><th className="pr-3 pb-2 font-medium">Livro</th><th className="pb-2 font-medium">Leitura</th></tr>
        </thead>
        <tbody>
          {linhas.map((l) => (
            <tr key={l.parametro} className="border-t border-fio">
              <td className="py-2 pr-3 font-medium">{l.parametro}</td>
              <td className="py-2 pr-3 tabular-nums">{l.valor}</td>
              <td className="py-2 pr-3">{l.livro} <span className="text-tinta-sussurro">({l.pagina})</span>{l.nota && <span className="mt-0.5 block text-tinta-sussurro">{l.nota}</span>}</td>
              <td className={cn('py-2 font-medium', COR[l.estado])}>{ROTULO[l.estado]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

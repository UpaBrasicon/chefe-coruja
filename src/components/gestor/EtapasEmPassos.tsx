import { Check } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Etapas de um fluxo em passos (revisão de perfis do Gestor, AIH M3, APAC M1,
 * BPA M1 e Farmácia M1): feito, atual e por fazer, numa linha que quebra no
 * celular. `atual` é o índice do passo em andamento; igual ao tamanho, tudo feito.
 * `parou` marca o passo atual como interrompido (rejeitada, cancelada).
 */
export function EtapasEmPassos({ passos, atual, parou, rotulo }: { passos: string[]; atual: number; parou?: string; rotulo: string }) {
  return (
    <ol aria-label={rotulo} className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-rotulo">
      {passos.map((p, i) => {
        const feito = i < atual
        const agora = i === atual
        return (
          <li key={p} aria-current={agora ? 'step' : undefined} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className={cn('h-px w-3', feito || agora ? 'bg-acao' : 'bg-fio')} />}
            <span className={cn('inline-flex items-center gap-1 rounded-capsula border px-2 py-px',
              feito ? 'border-acao/30 text-acao'
                : agora ? (parou ? 'border-critico/40 bg-alerta-critico font-medium text-critico' : 'border-acao bg-alerta-marca font-medium text-acao')
                  : 'border-fio text-tinta-sussurro')}>
              {feito && <Check className="size-3" aria-hidden />}
              {agora && parou ? parou : p}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

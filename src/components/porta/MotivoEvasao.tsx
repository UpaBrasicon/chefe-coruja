import { MOTIVOS_EVASAO, type MotivoEvasao } from '@/lib/evasao'
import { cn } from '@/lib/utils'

/** Motivo da evasão, de lista curta (Fase 1, tarefa 6): obrigatório ao registrar evasão. */
export function SeletorMotivoEvasao({ valor, onChange, invalido }: { valor: MotivoEvasao | null; onChange: (v: MotivoEvasao) => void; invalido?: boolean }) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className={cn('text-apoio font-medium', invalido ? 'text-critico' : 'text-grafite')}>Por que saiu?</span>
      <div role="radiogroup" aria-label="Motivo da evasão" className="flex flex-wrap gap-[7px]">
        {MOTIVOS_EVASAO.map((m) => (
          <button
            key={m.valor}
            type="button"
            role="radio"
            aria-checked={valor === m.valor}
            onClick={() => onChange(m.valor)}
            className={cn(
              'min-h-9 rounded-capsula border px-[13px] text-apoio whitespace-nowrap transition-colors',
              valor === m.valor ? 'border-marca bg-marca/10 font-medium text-acao' : 'border-fio bg-superficie text-tinta-apoio hover:border-acao',
            )}
          >
            {m.rotulo}
          </button>
        ))}
      </div>
      {invalido && <span className="text-rotulo text-critico">Escolha o motivo da evasão.</span>}
    </div>
  )
}

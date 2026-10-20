import { MOTIVOS_EVASAO, type MotivoEvasao } from '@/lib/evasao'
import { cn } from '@/lib/utils'
import { Chip } from '@/components/monitor/Pagina'

/** Motivo da evasão, de lista curta (Fase 1, tarefa 6): obrigatório ao registrar evasão. */
export function SeletorMotivoEvasao({ valor, onChange, invalido }: { valor: MotivoEvasao | null; onChange: (v: MotivoEvasao) => void; invalido?: boolean }) {
  return (
    <div className="flex flex-col gap-[7px]">
      <span className={cn('text-apoio font-medium', invalido ? 'text-critico' : 'text-grafite')}>Por que saiu?</span>
      <div role="radiogroup" aria-label="Motivo da evasão" className="flex flex-wrap gap-[7px]">
        {MOTIVOS_EVASAO.map((m) => (
          <Chip key={m.valor} variante="opcao" radio ativo={valor === m.valor} onClick={() => onChange(m.valor)}>
            {m.rotulo}
          </Chip>
        ))}
      </div>
      {invalido && <span className="text-rotulo text-critico">Escolha o motivo da evasão.</span>}
    </div>
  )
}

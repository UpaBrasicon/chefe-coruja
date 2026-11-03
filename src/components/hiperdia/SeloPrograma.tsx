// Selo do programa do hiperdia (5A, tarefa 7): hipertensão ou diabetes.
import { ROTULO_PROGRAMA, type Programa } from '@/domain/hiperdia'
import { cn } from '@/lib/utils'

export function SeloPrograma({ programa }: { programa: Programa }) {
  return (
    <span className={cn('rounded-capsula px-2 py-0.5 text-rotulo font-medium',
      programa === 'hipertensao' ? 'bg-alerta-marca text-acao' : 'bg-alerta-atencao text-atencao')}>
      {ROTULO_PROGRAMA[programa]}
    </span>
  )
}

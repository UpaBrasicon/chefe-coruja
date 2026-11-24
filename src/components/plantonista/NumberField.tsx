import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export function NumberField({
  id,
  label,
  unit,
  value,
  onChange,
  min = 0,
  max,
  step = 1,
  normalMin,
  normalMax,
  normalLabel,
  className,
}: {
  id: string
  label: string
  unit?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  normalMin?: number
  normalMax?: number
  normalLabel?: string
  className?: string
}) {
  const fora =
    value !== 0 &&
    value !== undefined &&
    normalMin !== undefined &&
    normalMax !== undefined &&
    (value < normalMin || value > normalMax)

  return (
    // Campos desalinhados (RT, 24/11/2026): na grade, o rótulo cresce e encosta
    // embaixo, então rótulo de uma ou de duas linhas deixa as caixas da mesma
    // linha na mesma altura. A unidade não quebra no meio.
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id} className="flex-1 items-end leading-snug">
        <span>
          {label} {unit && <span className="whitespace-nowrap text-rotulo text-tinta-sussurro">({unit})</span>}
        </span>
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ''}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') {
            onChange(0)
            return
          }
          const n = Number(v)
          if (Number.isFinite(n)) onChange(n)
        }}
      />
      {normalMin !== undefined && normalMax !== undefined && (
        <p className={`text-rotulo ${fora ? 'text-atencao' : 'text-tinta-sussurro'}`}>
          {normalLabel ?? 'Faixa normal'}: {normalMin} – {normalMax}
          {fora && ' ⚠ fora do intervalo'}
        </p>
      )}
    </div>
  )
}

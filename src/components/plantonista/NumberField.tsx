import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

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
}) {
  const fora =
    value !== 0 &&
    value !== undefined &&
    normalMin !== undefined &&
    normalMax !== undefined &&
    (value < normalMin || value > normalMax)

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>
        {label} {unit && <span className="text-xs text-muted-foreground">({unit})</span>}
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
        <p className={`text-xs ${fora ? 'text-amber-600' : 'text-muted-foreground'}`}>
          {normalLabel ?? 'Faixa normal'}: {normalMin} – {normalMax}
          {fora && ' ⚠ fora do intervalo'}
        </p>
      )}
    </div>
  )
}

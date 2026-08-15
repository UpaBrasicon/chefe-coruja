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
}: {
  id: string
  label: string
  unit?: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
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
    </div>
  )
}

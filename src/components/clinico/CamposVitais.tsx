import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { obrigatorio, VITAIS, type Publico } from '@/domain/vitais'

export function CamposVitais({
  publico,
  valores,
  onChange,
  prefixo = 'v',
}: {
  publico: Publico | null
  valores: Record<string, string>
  onChange: (k: string, v: string) => void
  prefixo?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {VITAIS.map((v) => (
        <div key={v.k} className="flex flex-col gap-1">
          <Label htmlFor={`${prefixo}-${v.k}`}>
            {v.rotulo}
            {obrigatorio(v, publico) ? ' *' : ''}
          </Label>
          <Input
            id={`${prefixo}-${v.k}`}
            inputMode="decimal"
            placeholder={v.un}
            value={valores[v.k] ?? ''}
            onChange={(e) => onChange(v.k, e.target.value)}
          />
        </div>
      ))}
    </div>
  )
}

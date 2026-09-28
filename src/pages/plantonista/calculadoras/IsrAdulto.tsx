import { useState } from 'react'

import { DROGAS_ISR, calcularIsr, fichaIsrAdulto, type DrogaIsr } from '@/clinico/adulto/isr'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const PAPEL: Record<DrogaIsr['papel'], string> = { inducao: 'Indução', analgesia: 'Analgesia', bloqueio: 'Bloqueio neuromuscular' }

/** Intubação em sequência rápida do adulto (Anexo 1 do manual do HCFMUSP). */
export function IsrAdulto() {
  const [peso, setPeso] = useState(0)
  return (
    <ToolLayout
      title="Intubação em sequência rápida — adulto"
      description="Dose, volume e ampolas por peso, pelo padrão do HC. Adulto (14 anos ou mais)."
      ficha={fichaIsrAdulto}
    >
      <Card>
        <CardContent className="pt-6">
          <NumberField id="isr-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={0} step={0.1} />
        </CardContent>
      </Card>
      {(Object.keys(PAPEL) as DrogaIsr['papel'][]).map((p) => (
        <Card key={p}>
          <CardHeader>
            <CardTitle className="text-base">{PAPEL[p]}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {DROGAS_ISR.filter((d) => d.papel === p).map((d) => {
              const r = calcularIsr(d, peso)
              return (
                <div key={d.id} className="rounded-lg border px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{d.nome}</span>
                    <span className="tabular-nums">
                      {r ? <><strong>{r.dose}</strong> · {r.volumeMl} mL{r.ampolas > 1 ? ` · ${r.ampolas} ampolas` : ''}</> : 'informe o peso'}
                    </span>
                  </div>
                  <p className="text-muted-foreground">
                    {d.fixa ? `dose fixa ${d.fixa.minUg}–${d.fixa.maxUg} µg` : `${d.mgKg!.toLocaleString('pt-BR')} mg/kg`} · {d.apresentacao}
                  </p>
                  {d.nota && <p className="text-muted-foreground">Divergência no livro: {d.nota}</p>}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
    </ToolLayout>
  )
}

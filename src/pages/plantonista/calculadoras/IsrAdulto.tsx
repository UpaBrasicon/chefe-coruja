import { useState } from 'react'

import { DIFERENCAS_DAS_2025, DIRETRIZ_DAS_2025, DROGAS_ISR, NOTA_ATS_PRE_OXIGENACAO, calcularIsr, fichaIsrAdulto, type DrogaIsr } from '@/clinico/adulto/isr'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { numero } from '@/lib/formato'

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
      <p role="note" className="rounded-controle border border-atencao/40 bg-alerta-atencao px-3 py-2 text-apoio text-atencao">{NOTA_ATS_PRE_OXIGENACAO}</p>
      {(Object.keys(PAPEL) as DrogaIsr['papel'][]).map((p) => (
        <Card key={p}>
          <CardHeader>
            <CardTitle className="text-corpo">{PAPEL[p]}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {DROGAS_ISR.filter((d) => d.papel === p).map((d) => {
              const r = calcularIsr(d, peso)
              return (
                <div key={d.id} className="rounded-controle border px-3 py-2 text-apoio">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium">{d.nome}</span>
                    <span className="tabular-nums">
                      {r ? <><strong>{r.dose}</strong> · {r.volumeMl} mL{r.ampolas > 1 ? ` · ${r.ampolas} ampolas` : ''}</> : 'informe o peso'}
                    </span>
                  </div>
                  <p className="text-tinta-sussurro">
                    {d.fixa ? `dose fixa ${d.fixa.minUg}–${d.fixa.maxUg} µg` : `${numero(d.mgKg!)} mg/kg`} · {d.apresentacao}
                  </p>
                  {d.nota && <p className="text-tinta-sussurro">Divergência no livro: {d.nota}</p>}
                </div>
              )
            })}
          </CardContent>
        </Card>
      ))}
      <Card>
        <CardHeader>
          <CardTitle className="text-corpo">DAS 2025 — ao lado do manual</CardTitle>
          <p className="text-apoio text-tinta-sussurro">Difficult Airway Society 2025, lida no texto integral: recomendações de consenso, sem classe. As doses do Anexo 1 acima continuam valendo.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="overflow-x-auto">
            <Table variante="referencia" className="w-full min-w-[640px] text-left align-top text-apoio">
              <TableHeader className="text-tinta-sussurro"><TableRow><TableHead className="pr-3 pb-2">Tema</TableHead><TableHead className="pr-3 pb-2">DAS 2025</TableHead><TableHead className="pr-3 pb-2">Manual do HC</TableHead></TableRow></TableHeader>
              <TableBody>{DIRETRIZ_DAS_2025.map((d) => <TableRow key={d.tema} className="border-t"><TableCell className="pr-3 py-2 font-medium">{d.tema}</TableCell><TableCell className="pr-3 py-2">{d.das} <span className="text-tinta-sussurro">({d.onde})</span></TableCell><TableCell className="pr-3 py-2 text-tinta-sussurro">{d.livro}</TableCell></TableRow>)}</TableBody>
            </Table>
          </div>
          <ul className="list-disc pl-5 text-apoio text-tinta-sussurro">{DIFERENCAS_DAS_2025.map((d) => <li key={d}>{d}</li>)}</ul>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}

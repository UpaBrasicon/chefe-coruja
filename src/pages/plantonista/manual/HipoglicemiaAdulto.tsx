import { useState } from 'react'

import { HIPOGLICEMIA_DOSES, LIMIAR_HIPOGLICEMIA, abaixoDoLimiar, fichaHipoglicemia, gramasGlicose50 } from '@/clinico/adulto/glicemia'
import { NumberField } from '@/components/plantonista/NumberField'
import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'

/** Hipoglicemia no adulto: limiar e doses — cap. 65 do manual do HCFMUSP. */
export function HipoglicemiaAdulto() {
  const [glic, setGlic] = useState(0)
  const [dm, setDm] = useState(false)
  const abaixo = glic > 0 ? abaixoDoLimiar(glic, dm) : null
  const [g0, g1] = HIPOGLICEMIA_DOSES.glicose50Ml

  return (
    <ToolLayout
      title="Hipoglicemia — limiar e doses"
      description="Limiar de glicemia com e sem diabetes e as doses de glicose 50%, glucagon e tiamina que o manual do HCFMUSP traz. Adulto (14 anos ou mais)."
      ficha={fichaHipoglicemia}
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <NumberField id="hipog-glic" label="Glicemia" unit="mg/dL" value={glic} onChange={setGlic} />
          <div className="flex flex-col gap-1.5">
            <Label>Diabetes melito</Label>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={dm ? 'default' : 'outline'} onClick={() => setDm(true)}>Com DM</Button>
              <Button type="button" size="sm" variant={!dm ? 'default' : 'outline'} onClick={() => setDm(false)}>Sem DM</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Limiar (p. 877, 881)</CardTitle>
          <CardDescription>
            Sem DM: &lt; {LIMIAR_HIPOGLICEMIA.semDmTexto} mg/dL no texto (tríade de Whipple, p. 877) — a Figura 1 (p. 881) usa &lt; {LIMIAR_HIPOGLICEMIA.semDmFigura}. Com DM: &lt; {LIMIAR_HIPOGLICEMIA.comDm} mg/dL já pode dar sintomas.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {abaixo === null ? <p className="text-tinta-sussurro">Informe a glicemia.</p> : (
            <p>
              Glicemia {glic} mg/dL {abaixo ? <strong>abaixo</strong> : 'não está abaixo'} do limiar do manual para paciente {dm ? 'com' : 'sem'} DM
              {!dm && glic >= LIMIAR_HIPOGLICEMIA.semDmTexto && glic < LIMIAR_HIPOGLICEMIA.semDmFigura && ' (mas abaixo do corte de 50 da Figura 1)'}.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">O que o manual traz (p. 880–881)</CardTitle>
          <CardDescription>Doses fixas do adulto; não há dose por peso no capítulo.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p>Glicose 50%: <strong>{g0}–{g1} mL</strong> EV ({gramasGlicose50(g0)}–{gramasGlicose50(g1)} g de glicose).</p>
          <p>Sem acesso venoso: glucagon <strong>{HIPOGLICEMIA_DOSES.glucagonMg[0]}–{HIPOGLICEMIA_DOSES.glucagonMg[1]} mg IM</strong> — efeito fugaz, esgota o glicogênio hepático; o manual diz que não é possível repetir.</p>
          <p>Desnutridos, hepatopatas ou etilistas: tiamina <strong>{HIPOGLICEMIA_DOSES.tiaminaMg} mg IV ou IM</strong> junto com a glicose (Wernicke-Korsakoff).</p>
          <p>DM com alto risco de recorrência (p. ex. insuficiência renal crônica): observação por {HIPOGLICEMIA_DOSES.observacaoHoras[0]}–{HIPOGLICEMIA_DOSES.observacaoHoras[1]} h com glicemia capilar 1/1 h.</p>
          <p className="text-xs text-tinta-sussurro"><Badge variant="outline" className="mr-1">errata</Badge>Limiar sem DM: 45 mg/dL no texto (p. 877) e 50 mg/dL na Figura 1 (p. 881). A ferramenta usa o texto e mostra o corte da figura.</p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}

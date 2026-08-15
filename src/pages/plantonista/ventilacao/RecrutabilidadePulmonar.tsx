import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { NumberField } from '@/components/plantonista/NumberField'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export function RecrutabilidadePulmonar() {
  const [vcInspirado, setVcInspirado] = useState(500)
  const [vcAlta, setVcAlta] = useState(500)
  const [vcBaixa, setVcBaixa] = useState(400)
  const [pplatBaixa, setPplatBaixa] = useState(22)
  const [peepBaixa, setPeepBaixa] = useState(5)
  const [peepAlta, setPeepAlta] = useState(15)

  const vhi = vcAlta || vcInspirado
  const vlo = vcBaixa
  const dv = vhi - vlo
  const crs = vlo / (pplatBaixa - peepBaixa)
  const dP = peepAlta - peepBaixa
  const dVinf = dP * crs
  const ri = dv / (dv + dVinf)

  return (
    <ToolLayout
      title="Calcular Recrutabilidade Pulmonar"
      description="Relação recrutamento/inflação (R/I ratio). Valor ≥ 0,5 sugere maior potencial de recrutamento."
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <NumberField id="rc-insp" label="VC inspirado" unit="mL" value={vcInspirado} onChange={setVcInspirado} min={100} />
          <NumberField id="rc-alta" label="VC expirado — PEEP alta" unit="mL" value={vcAlta} onChange={setVcAlta} min={100} />
          <NumberField id="rc-baixa" label="VC expirado — após redução da PEEP" unit="mL" value={vcBaixa} onChange={setVcBaixa} min={100} />
          <NumberField id="rc-pplat" label="Pplatô com PEEP baixa" unit="cmH₂O" value={pplatBaixa} onChange={setPplatBaixa} min={1} />
          <NumberField id="rc-peep-b" label="PEEP baixa" unit="cmH₂O" value={peepBaixa} onChange={setPeepBaixa} min={0} />
          <NumberField id="rc-peep-a" label="PEEP alta" unit="cmH₂O" value={peepAlta} onChange={setPeepAlta} min={0} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-base">
            R/I ratio =
            <Badge className="text-lg">{ri.toFixed(2)}</Badge>
            {ri >= 0.5 ? (
              <Badge variant="success">Recrutável</Badge>
            ) : (
              <Badge variant="secondary">Pouco recrutável</Badge>
            )}
          </CardTitle>
          <CardDescription>
            ΔV de recrutamento: {dv} mL · Complacência (Crs): {crs.toFixed(1)} mL/cmH₂O · ΔV por
            inflação: {dVinf.toFixed(0)} mL
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Valor ≥ 0,5 sugere maior potencial de recrutamento pulmonar.
          </p>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}

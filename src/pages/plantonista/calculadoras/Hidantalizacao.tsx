import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { NumberField } from '@/components/plantonista/NumberField'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function Hidantalizacao() {
  const [peso, setPeso] = useState(70)
  const [doseKg, setDoseKg] = useState(17.5)
  const [taxa, setTaxa] = useState(35)

  const doseMg = peso * doseKg
  const mlFenitoina = doseMg / 50 // Fenitoína 50 mg/mL
  const volumeTotal = mlFenitoina + 241 // + 241 mL SF 0,9%
  const tempoMin = doseMg / taxa
  const vazaoMlH = (volumeTotal / tempoMin) * 60

  return (
    <ToolLayout
      title="Hidantalização"
      description="Ataque com fenitoína (15–20 mg/kg) e manutenção."
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <NumberField id="hid-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={1} />
          <div className="flex flex-col gap-2">
            <Label>Dose (mg/kg)</Label>
            <Select value={String(doseKg)} onValueChange={(v) => setDoseKg(Number(v ?? 17.5))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="17.5">17,5</SelectItem>
                <SelectItem value="20">20</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Taxa de infusão (mg/min)</Label>
            <Select value={String(taxa)} onValueChange={(v) => setTaxa(Number(v ?? 35))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="35">35</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ataque (hidantalização)</CardTitle>
          <CardDescription>Fenitoína (50 mg/mL).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="text-base">{doseMg.toFixed(0)} mg</Badge>
            <Badge variant="outline">{mlFenitoina.toFixed(1)} mL de fenitoína</Badge>
            <Badge variant="outline">{volumeTotal.toFixed(0)} mL (com 241 mL SF 0,9%)</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="secondary">Tempo de infusão: {tempoMin.toFixed(0)} min</Badge>
            <Badge variant="secondary">Vazão: {vazaoMlH.toFixed(0)} mL/h</Badge>
          </div>
          <p className="text-xs text-amber-700">
            ☞ Durante a infusão, monitoramento contínuo de FC e PA. Reduzir a taxa em caso de efeitos
            colaterais.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manutenção</CardTitle>
          <CardDescription>VO ou EV, conforme nível de consciência.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="rounded-lg border px-3 py-2 text-sm">
            <Badge variant="secondary" className="mb-1">EV</Badge>
            <p>Fenitoína (50 mg/mL): 2 mL + 18 mL AD → <strong>EV 8/8h</strong> (100 mg).</p>
          </div>
          <div className="rounded-lg border px-3 py-2 text-sm">
            <Badge variant="secondary" className="mb-1">VO</Badge>
            <p>Fenitoína (100 mg/cp): 1 comprimido → <strong>VO 8/8h</strong>.</p>
          </div>
        </CardContent>
      </Card>
    </ToolLayout>
  )
}

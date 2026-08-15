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

const ajustes = [
  { faixa: '< 35', bolo: '80 U/kg', interromper: 'Não', infusao: '↑ 4 U/kg/h' },
  { faixa: '35 – 45', bolo: '40 U/kg', interromper: 'Não', infusao: '↑ 3 U/kg/h' },
  { faixa: '46 – 60', bolo: '40 U/kg', interromper: 'Não', infusao: '↑ 2 U/kg/h' },
  { faixa: '61 – 85', bolo: '—', interromper: 'Não', infusao: 'Manter' },
  { faixa: '86 – 110', bolo: '—', interromper: 'Não', infusao: '↓ 2 U/kg/h' },
  { faixa: '> 110', bolo: '—', interromper: '60 min', infusao: '↓ 4 U/kg/h' },
]

export function HeparinizacaoVenosa() {
  const [peso, setPeso] = useState(70)
  const [ttpa, setTtpa] = useState(3)

  const boloU = peso * 80
  const boloMl = boloU / 5000 // Heparina 5000 U/mL
  const infusaoUh = peso * 12
  const infusaoMlH = infusaoUh / 100 // 1 mL = 100 U

  return (
    <ToolLayout
      title="Início da Heparinização Venosa"
      description="Bólus inicial 80 U/kg e infusão contínua 12 U/kg/h, com ajuste pelo TTPa."
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <NumberField id="hep-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={1} />
          <div className="flex flex-col gap-2">
            <Label>TTPa (para ajuste)</Label>
            <Select value={ajustes[ttpa].faixa} onValueChange={(v) => setTtpa(Math.max(0, ajustes.findIndex((a) => a.faixa === v)))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ajustes.map((a) => (
                  <SelectItem key={a.faixa} value={a.faixa}>{a.faixa} s</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bólus inicial</CardTitle>
            <CardDescription>Heparina (5000 U/mL)</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Badge className="text-base">{boloU.toFixed(0)} U</Badge>
            <Badge variant="outline">{boloMl.toFixed(1)} mL EV</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Infusão contínua</CardTitle>
            <CardDescription>5 mL + 245 mL SF 0,9% → 1 mL = 100 U</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Badge className="text-base">{infusaoUh.toFixed(0)} U/h</Badge>
            <Badge variant="outline">{infusaoMlH.toFixed(1)} mL/h</Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ajuste pelo TTPa (a cada 6 h)</CardTitle>
          <CardDescription>TTPa alvo: 61 – 85 s.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="grid grid-cols-4 gap-2 border-b pb-2 text-xs font-medium text-muted-foreground">
            <span>TTPa (s)</span><span>Bólus</span><span>Interrupção</span><span>Infusão</span>
          </div>
          {ajustes.map((a) => (
            <div key={a.faixa} className={`grid grid-cols-4 gap-2 rounded-md px-2 py-1.5 text-sm ${a.faixa === ajustes[ttpa].faixa ? 'bg-primary/10 ring-1 ring-primary' : ''}`}>
              <span className="font-medium">{a.faixa}</span>
              <span>{a.bolo}</span>
              <span>{a.interromper}</span>
              <span>{a.infusao}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </ToolLayout>
  )
}

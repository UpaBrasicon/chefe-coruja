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

export function SuporteVentilatorio() {
  const [altura, setAltura] = useState(170)
  const [sexo, setSexo] = useState<'homem' | 'mulher'>('homem')
  const [pO2, setPO2] = useState(80)
  const [fio2, setFio2] = useState(40)
  const [ph, setPh] = useState(7.35)
  const [pco2, setPco2] = useState(40)

  const alturaIn = altura / 2.54
  const pesoPredito = sexo === 'homem' ? 50 + 2.3 * (alturaIn - 60) : 45.5 + 2.3 * (alturaIn - 60)
  const vcIdeal = 6 * pesoPredito
  const pf = pO2 / (fio2 / 100)

  return (
    <ToolLayout
      title="Suporte Ventilatório"
      description="Cálculo de peso predito, volume corrente ideal (6 mL/kg) e relação P/F."
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <NumberField id="sv-altura" label="Altura" unit="cm" value={altura} onChange={setAltura} min={100} />
          <div className="flex flex-col gap-2">
            <Label>Sexo</Label>
            <Select value={sexo} onValueChange={(v) => setSexo((v as 'homem') ?? 'homem')}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="homem">Homem</SelectItem>
                <SelectItem value="mulher">Mulher</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <NumberField id="sv-po2" label="PaO₂" unit="mmHg" value={pO2} onChange={setPO2} min={1} />
          <NumberField id="sv-fio2" label="FiO₂" unit="%" value={fio2} onChange={setFio2} min={21} max={100} />
          <NumberField id="sv-ph" label="pH" value={ph} onChange={setPh} min={6.5} max={7.9} step={0.01} />
          <NumberField id="sv-pco2" label="PaCO₂" unit="mmHg" value={pco2} onChange={setPco2} min={1} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Parâmetros</CardTitle>
            <CardDescription>Peso predito (tabela de peso ideal) e volume corrente alvo.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Peso predito:</span>
              <Badge>{pesoPredito.toFixed(1)} kg</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">VC ideal (6 mL/kg):</span>
              <Badge>{vcIdeal.toFixed(0)} mL</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Trocas (P/F):</span>
              <Badge>{pf.toFixed(0)}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metas ventilatórias</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>☞ PaO₂ alvo 55 – 80 mmHg (ou SpO₂ 88 – 95%).</p>
            <p>☞ Ajustar FiO₂ para manter SpO₂ no alvo.</p>
            <p>☞ FR entre 12 – 20 irpm; avaliar PaCO₂ e pH.</p>
            <p>☞ Evitar Pplatô &gt; 30 cmH₂O (proteção pulmonar).</p>
          </CardContent>
        </Card>
      </div>
    </ToolLayout>
  )
}

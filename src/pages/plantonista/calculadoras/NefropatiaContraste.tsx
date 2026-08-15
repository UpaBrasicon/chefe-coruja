import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { NumberField } from '@/components/plantonista/NumberField'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function NefropatiaContraste() {
  const [idade, setIdade] = useState(60)
  const [peso, setPeso] = useState(70)
  const [creat, setCreat] = useState(1.2)
  const [sexo, setSexo] = useState<'homem' | 'mulher'>('homem')
  const [calculado, setCalculado] = useState(false)

  const clCr = ((140 - idade) * peso) / (72 * creat) * (sexo === 'mulher' ? 0.85 : 1)
  const indicaNefro = clCr < 60

  return (
    <ToolLayout
      title="Prevenção de Nefropatia Induzida por Contraste"
      description="Estimativa de função renal (Cockcroft–Gault) e nefroproteção."
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <NumberField id="ncf-idade" label="Idade" unit="anos" value={idade} onChange={setIdade} min={1} />
          <NumberField id="ncf-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={1} />
          <NumberField id="ncf-creat" label="Creatinina" unit="mg/dL" value={creat} onChange={setCreat} min={0.1} step={0.1} />
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
        </CardContent>
      </Card>

      <div>
        <Button onClick={() => setCalculado(true)}>CALCULAR</Button>
      </div>

      {calculado && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ClCr (Cockcroft–Gault)</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <Badge className="text-base">{clCr.toFixed(1)} mL/min</Badge>
              {indicaNefro ? (
                <Badge variant="destructive">⇒ Fazer Nefroproteção</Badge>
              ) : (
                <Badge variant="success">Função renal preservada</Badge>
              )}
            </CardContent>
          </Card>

          {indicaNefro && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Nefroproteção</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3 text-sm">
                <div className="rounded-lg border p-3">
                  <Badge variant="secondary" className="mb-1">Hidratação</Badge>
                  <p>
                    <strong>SF 0,9% EV</strong> 1–1,5 mL/kg/h ({((1.25 * peso)).toFixed(0)} mL/h)
                    12 h antes do exame e manter por 12 h após.
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ou Bicarbonato de Sódio 8,4%: 150 mL + 850 mL SG 5% → 3 mL/kg/h 1 h antes e 1
                    mL/kg/h por 6 h após.
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <Badge variant="secondary" className="mb-1">N-Acetilcisteína</Badge>
                  <p>600 mg VO/EV 8/8h — iniciar 24 h antes e manter no dia do exame.</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <Badge variant="warning" className="mb-1">Suspender por 24–48 h</Badge>
                  <p>IECA, BRA, Diuréticos e Metformina — antes e após o exame.</p>
                  <p className="mt-1">Avaliar função renal a cada 48 h.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </ToolLayout>
  )
}

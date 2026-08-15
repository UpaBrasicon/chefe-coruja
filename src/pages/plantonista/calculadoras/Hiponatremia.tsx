import { useState } from 'react'

import { ToolLayout } from '@/components/plantonista/ToolLayout'
import { NumberField } from '@/components/plantonista/NumberField'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

export function Hiponatremia() {
  const [peso, setPeso] = useState(70)
  const [naAtual, setNaAtual] = useState(125)
  const [naDesejado, setNaDesejado] = useState(133)
  const [sexo, setSexo] = useState<'homem' | 'mulher'>('homem')
  const [calculado, setCalculado] = useState(false)

  const vd = sexo === 'homem' ? 0.6 : 0.5
  const deficit = peso * vd * (naDesejado - naAtual)
  const mlNaCl3 = (deficit / 513) * 1000 // NaCl 3% = 513 mEq/L
  const mlPara8 = ((peso * vd * 8) / 513) * 1000
  const volumeUsado = Math.min(mlNaCl3, mlPara8)
  const elevacao = (volumeUsado / 1000) * 513 / (peso * vd)

  return (
    <ToolLayout
      title="Reposição venosa de Na⁺ nas primeiras 24 horas"
      description="Cálculo de déficit e volume de NaCl 3%, limitado à elevação máxima segura de 8 mEq/L em 24 h."
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-2">
          <NumberField id="hipo-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={1} />
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
          <NumberField id="hipo-na" label="Sódio atual" unit="mEq/L" value={naAtual} onChange={setNaAtual} min={100} />
          <NumberField id="hipo-na-des" label="Sódio desejado" unit="mEq/L" value={naDesejado} onChange={setNaDesejado} min={120} />
        </CardContent>
      </Card>

      <div>
        <Button onClick={() => setCalculado(true)}>Calcular</Button>
      </div>

      {calculado && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultado</CardTitle>
            <CardDescription>NaCl 3% (513 mEq/L).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">Déficit de Na⁺:</span>
              <Badge className="text-base">{deficit.toFixed(0)} mEq</Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-muted-foreground">Volume para o déficit:</span>
              <Badge className="text-base">{mlNaCl3.toFixed(0)} mL</Badge>
              <span className="text-sm text-muted-foreground">(elevação até {elevacao.toFixed(1)} mEq/L)</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Elevação máxima segura: 8 mEq/L em 24 h → volume de {mlPara8.toFixed(0)} mL.
            </p>
            <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3">
              <span className="text-sm font-medium">Volume a infundir em 24 h:</span>
              <Badge className="text-base">{volumeUsado.toFixed(0)} mL</Badge>
              <Badge variant="outline">{(volumeUsado / 24).toFixed(0)} mL/h</Badge>
            </div>
            <p className="text-xs text-amber-700">
              Solicitar Na⁺ sérico a cada 2 horas. Reavaliar constantemente.
            </p>
          </CardContent>
        </Card>
      )}
    </ToolLayout>
  )
}

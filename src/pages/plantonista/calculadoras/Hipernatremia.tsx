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

export function Hipernatremia() {
  const [peso, setPeso] = useState(70)
  const [na, setNa] = useState(150)
  const [sexo, setSexo] = useState<'homem' | 'mulher'>('homem')
  const [calculado, setCalculado] = useState(false)

  const vd = sexo === 'homem' ? 0.6 : 0.5

  // Déficit de água (L) para reduzir até 8 mEq/L em 24h
  const aguaLivreL = (peso * vd * 8) / 140
  const aguaLivreMl = aguaLivreL * 1000

  const solucoes = [
    { nome: 'Água livre', volume: aguaLivreMl, preparo: 'Água livre EV' },
    { nome: 'Soro Glicosado 5%', volume: aguaLivreMl, preparo: 'SG 5% EV' },
    { nome: 'Solução Salina 0,45%', volume: aguaLivreMl * 2, preparo: '250 mL SF 0,9% + 250 mL AD' },
    { nome: 'Solução Salina 0,225%', volume: aguaLivreMl * 4, preparo: '125 mL SF 0,9% + 375 mL AD' },
  ]

  return (
    <ToolLayout
      title="Manejo da Hipernatremia nas primeiras 24 horas"
      description="Volume de soluções hipotônicas para reduzir o Na⁺ sérico em até 8 mEq/L em 24 h."
    >
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <NumberField id="hiper-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={1} />
          <NumberField id="hiper-na" label="Sódio sérico" unit="mEq/L" value={na} onChange={setNa} min={145} />
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
        <Button onClick={() => setCalculado(true)}>Calcular</Button>
      </div>

      {calculado && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Volume por solução (redução ≤ 8 mEq/L em 24 h)</CardTitle>
              <CardDescription>Déficit de água livre: {(na / 140 - 1) * peso * vd > 0 ? (((na / 140 - 1) * peso * vd) * 1000).toFixed(0) : 0} mL (total).</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {solucoes.map((s) => (
                <div key={s.nome} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                  <div>
                    <div className="text-sm font-medium">{s.nome}</div>
                    <div className="text-xs text-muted-foreground">{s.preparo}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className="text-base">{s.volume.toFixed(0)} mL</Badge>
                    <Badge variant="outline">{(s.volume / 24).toFixed(0)} mL/h</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex flex-col gap-2 pt-6">
              <p className="text-sm text-amber-700">☞ Solicitar Na⁺ sérico a cada 2 horas.</p>
              <p className="text-sm text-amber-700">☞ Preferir a via enteral, se disponível.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </ToolLayout>
  )
}

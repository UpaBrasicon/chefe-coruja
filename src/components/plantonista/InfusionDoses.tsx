import { useState } from 'react'

import { NumberField } from '@/components/plantonista/NumberField'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CopyResult } from '@/components/plantonista/CopyResult'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type InfusaoDroga = {
  nome: string
  faixa: string
  preparo: string
  conc: number // concentração por mL, na mesma unidade da dose
  doseMin: number
  doseMax: number
  porPeso: boolean
  porMinuto: boolean
  unidade: string
}

export function InfusionDoses({ drogas, pesoPadrao = 70 }: { drogas: InfusaoDroga[]; pesoPadrao?: number }) {
  const [idx, setIdx] = useState(0)
  const [peso, setPeso] = useState(pesoPadrao)
  const [dose, setDose] = useState(drogas[0].doseMax)
  const droga = drogas[idx]

  const fatorPeso = droga.porPeso ? peso : 1
  const fatorTempo = droga.porMinuto ? 60 : 1
  const vazao = (dose * fatorPeso * fatorTempo) / droga.conc
  const gotasMin = vazao / 3 // macrogotas: 20 gotas/mL
  const microGotasMin = vazao // microgotas: 60 gotas/mL

  const textoPronto = [
    `${droga.nome} em infusão contínua EV.`,
    `Preparo: ${droga.preparo}.`,
    `Dose: ${dose} ${droga.unidade}${droga.porPeso ? ` (peso ${peso} kg)` : ''}.`,
    `Vazão: ${vazao.toFixed(1)} mL/h (${gotasMin.toFixed(0)} gotas/min em macrogotas; ${microGotasMin.toFixed(0)} em microgotas).`,
  ].join(' ')

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid gap-4 pt-6 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label>Droga</Label>
            <Select value={droga.nome} onValueChange={(v) => {
              const novoIdx = drogas.findIndex((d) => d.nome === v)
              setIdx(novoIdx)
              setDose(drogas[novoIdx].doseMax)
            }}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {drogas.map((d) => (
                  <SelectItem key={d.nome} value={d.nome}>{d.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {droga.porPeso && (
            <NumberField id="inf-peso" label="Peso" unit="kg" value={peso} onChange={setPeso} min={1} />
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inf-dose">
              Dose <span className="text-xs text-muted-foreground">({droga.unidade})</span>
            </Label>
            <Input
              id="inf-dose"
              type="number"
              step="any"
              value={dose}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) setDose(n)
              }}
            />
            <p className="text-xs text-muted-foreground">Faixa: {droga.faixa}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{droga.nome}</CardTitle>
          <CardDescription>{droga.preparo}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-muted-foreground">Vazão da infusão:</span>
          <Badge className="text-base">{vazao.toFixed(1)} mL/h</Badge>
          <Badge variant="outline">{gotasMin.toFixed(0)} gotas/min (macrogotas)</Badge>
          <Badge variant="outline">{microGotasMin.toFixed(0)} microgotas/min</Badge>
          <CopyResult texto={textoPronto} rotulo="Copiar para prescrição" />
        </CardContent>
      </Card>
    </div>
  )
}
